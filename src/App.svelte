<script>
  import LoginButton from './lib/LoginButton.svelte'
  import { user } from './lib/authStore'
  import { Client } from '@gradio/client'
  import { revisorCuotas, actualizarCuotaDespuesDeGenerar, guardarLogGeneracion, guardarLogError, incrementarUsos } from './lib/firebase'
  
  let name = 'Svelte Moibe'
  let textContent = ''
  let generatedImage = null
  let isLoading = false
  let error = null
  let progress = 0
  let progressInterval = null
  let selectedProvider = null
  let providerInfo = null
  let showLoginPrompt = false
  
  const SPACE_URL = 'https://black-forest-labs-flux-2-dev.hf.space'

  // Detectar GA Client al cargar la app (con o sin usuario logueado)
  const gaClient = window.gaClientID || null
  if (gaClient) {
    console.log('📊 GA Client detectado:', gaClient)
  } else {
    console.warn('⚠️ GA Client NO detectado')
  }
  
  // Limpiar imagen y texto cuando cierra sesión
  $: if (!$user) {
    generatedImage = null
    textContent = ''
  }

  // Cerrar el modal de login después de unos segundos cuando el usuario se loguea
  $: if ($user && showLoginPrompt) {
    setTimeout(() => {
      showLoginPrompt = false
    }, 2500)
  }

  function downloadImage() {
    if (!generatedImage) return
    
    // Obtener la imagen como blob y descargar
    fetch(generatedImage)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `splashmix-${Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        console.log('⬇️ Imagen descargada')
      })
      .catch(err => {
        console.error('❌ Error descargando imagen:', err)
      })
  }
  
  async function generateImage() {
    if (!textContent.trim()) {
      error = 'Por favor escribe algo primero'
      return
    }
    
    if (!$user) {
      showLoginPrompt = true
      return
    }
    
    isLoading = true
    error = null
    progress = 0
    
    // Inicia animación de barra de progreso
    progressInterval = setInterval(() => {
      progress += Math.random() * (progress < 80 ? 16 : 0.5)
      if (progress > 99) progress = 99
    }, 100)
    
    try {
      console.log('🎨 Generando imagen con prompt:', textContent)
      
      // Revisar cuotas y seleccionar proveedor
      providerInfo = await revisorCuotas()
      selectedProvider = providerInfo.proveedor
      const hfToken = providerInfo.token
      
      console.log(`✅ Proveedor seleccionado: ${providerInfo.proveedor}`)
      console.log(`📊 Cuota disponible: ${providerInfo.quotaDisponible} segundos`)
      console.log('🔑 Token:', hfToken ? `✅ Presente (${hfToken.slice(0, 10)}...)` : '❌ No encontrado')
      
      // Conectar al Space de Gradio
      console.log('🔗 Conectando a Space:', SPACE_URL)
      const client = await Client.connect(SPACE_URL, { token: hfToken })
      console.log('✅ Conexión exitosa al Space')
      
      // Llamar a predict con los parámetros de FLUX.2-dev
      const result = await client.predict('/infer', {
        prompt: textContent,
        input_images: [],
        seed: 0,
        randomize_seed: true,
        width: 1024,
        height: 1024,
        num_inference_steps: 30,
        guidance_scale: 4,
        prompt_upsampling: true
      })
      
      console.log('📦 Respuesta del Space:', result)
      
      // El resultado puede tener diferentes formatos
      let imageUrl = null
      let seed = null
      if (result.data && Array.isArray(result.data)) {
        // data[0] = imagen, data[1] = seed
        const imageData = result.data[0]
        seed = result.data[1]
        
        if (imageData && imageData.url) {
          imageUrl = imageData.url
        } else if (typeof imageData === 'string' && imageData.startsWith('http')) {
          imageUrl = imageData
        }
      }
      
      if (!imageUrl) {
        throw new Error('No se obtuvo URL de imagen del Space')
      }
      
      generatedImage = imageUrl
      console.log('✅ Imagen generada. URL:', imageUrl)
      console.log('🔑 Seed usado:', seed)
      progress = 100
      
      // Guardar log de generación (con seed y proveedor)
      console.log('📝 Guardando log de generación...')
      await guardarLogGeneracion($user, textContent, seed, providerInfo.proveedor)
      
      // Incrementar contador de usos
      console.log('📊 Incrementando contador de usos...')
      await incrementarUsos($user)
      
      // AHORA actualizar cuota (solo si la imagen se generó exitosamente)
      console.log('🔄 Actualizando cuota del proveedor...')
      await actualizarCuotaDespuesDeGenerar(providerInfo.proveedor, providerInfo.quotaDisponible)
      
    } catch (err) {
      console.error('❌ Error generando imagen:', err)
      error = 'Error al generar la imagen: ' + (err.message || 'Intenta de nuevo')
      generatedImage = null
      
      // Guardar log de error
      if ($user && selectedProvider) {
        await guardarLogError($user, textContent, err.message, selectedProvider)
      }
    } finally {
      clearInterval(progressInterval)
      isLoading = false
      progress = 0
    }
  }
</script>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }

  main {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
    background: linear-gradient(135deg, #0052cc 0%, #004999 50%, #003366 100%);
    min-height: 100vh;
    color: white;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
  }
  
  .header-top {
    background: white;
    border-bottom: 3px solid #2563eb;
    padding: 0.3rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .logo {
    font-weight: bold;
    color: #333;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    transition: color 0.3s ease;
  }

  .logo:hover {
    color: #2563eb;
  }

  .nav-links {
    display: flex;
    gap: 2rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .nav-links a {
    color: #666;
    text-decoration: none;
    font-size: 0.95rem;
    transition: color 0.3s ease;
  }

  .nav-links a:hover {
    color: #2563eb;
  }

  .header-right {
    display: flex;
    align-items: center;
    margin-left: auto;
  }

  .header-right a {
    background: #2563eb;
    color: white;
    padding: 0.6rem 1.5rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 500;
    transition: all 0.3s ease;
  }

  .header-right a:hover {
    background: #1e53a0;
    transform: translateY(-2px);
  }
  
  .content {
    padding: 2rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }
  
  .header {
    display: none;
  }
  
  .text-area-container {
    margin: 2rem 0;
    display: flex;
    justify-content: center;
    width: 100%;
  }
  
  textarea {
    width: 100%;
    max-width: 600px;
    min-height: 40px;
    padding: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto;
    font-size: 1rem;
    resize: vertical;
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
  }

  textarea::placeholder {
    color: rgba(255, 255, 255, 0.7);
  }
  
  textarea:disabled {
    background-color: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.5);
    cursor: not-allowed;
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  textarea:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
  }
  
  textarea:disabled:focus {
    box-shadow: none;
  }
  
  .button-container {
    margin: 1.5rem 0;
    display: flex;
    justify-content: center;
    width: 100%;
  }
  
  .create-button {
    background: #4A90E2;
    color: white;
    border: 2px solid #4A90E2;
    padding: 0.7rem 2rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
    transition: all 0.3s ease;
  }
  
  .create-button:hover {
    background: #357ABD;
    border-color: #357ABD;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.4);
  }
  
  .create-button:disabled {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.5);
    cursor: not-allowed;
    border-color: rgba(255, 255, 255, 0.2);
  }
  
  .create-button:disabled:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: none;
  }
    .login-prompt {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 2rem;
    border-radius: 16px;
    box-shadow: 
      0 0 30px rgba(74, 144, 226, 0.6), 
      0 0 60px rgba(74, 144, 226, 0.3),
      0 8px 32px rgba(0, 0, 0, 0.15);
    z-index: 2000;
    text-align: center;
    animation: slideIn 0.3s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    min-width: 350px;
  }

  @keyframes slideIn {
    from {
      transform: translate(-50%, -60%);
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%);
      opacity: 1;
    }
  }

  .login-prompt-text {
    color: #333;
    font-size: 1.1rem;
    font-weight: 500;
    margin-bottom: 1.5rem;
  }

  .login-prompt-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 1999;
  }
    .image-container {
    margin-top: 3rem;
    display: flex;
    justify-content: center;
    min-height: 300px;
    width: 100%;
  }
  
  .image-display {
    width: 100%;
    max-width: 600px;
    padding: 1.5rem;
    border: 2px dashed rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
  }
  
  .image-display img {
    width: 100%;
    height: auto;
    border-radius: 8px;
    color: white;
  }

  .image-wrapper {
    position: relative;
    width: 100%;
  }

  .download-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 10;
  }

  .download-btn:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
  }

  .download-btn:active {
    transform: scale(0.95);
  }
  
  .create-button:active {
    transform: scale(0.98);
  }
  
  .error-message {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(220, 38, 38, 0.1);
    color: #fca5a5;
    border: 1px solid rgba(220, 38, 38, 0.3);
    border-radius: 6px;
    text-align: center;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }
  
  .progress-bar {
    width: 100%;
    max-width: 600px;
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    margin: 1.5rem auto;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #2196F3, #1976D2);
    transition: width 0.2s ease;
  }
  
  .provider-info {
    text-align: center;
    margin-top: 0.5rem;
    font-size: 0.9rem;
    color: #666;
  }
</style>

<main>
  <div class="header-top">
    <div class="header-left">
      <a href="https://splashmix.ink" class="logo">
        <span>splashmix.ink</span>
        <span>🐙</span>
      </a>
    </div>
    <div class="header-right">
      <LoginButton />
    </div>
  </div>

  <div class="content">
    <div class="text-area-container">
      <textarea bind:value={textContent} placeholder="Escribe lo que quieres crear aquí, por ejemplo: Un astronauta flotando en el espacio."></textarea>
    </div>
    
    <div class="button-container">
      <button class="create-button" disabled={isLoading} on:click={generateImage}>
        {isLoading ? '⏳ Generando...' : '🖼️ Crear imagen'}
    </button>
  </div>
  
  {#if isLoading}
    <div class="progress-bar">
      <div class="progress-fill" style="width: {progress}%"></div>
    </div>
  {/if}
  
  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if showLoginPrompt}
    <div class="login-prompt-backdrop" on:click={() => showLoginPrompt = false}></div>
    <div class="login-prompt">
      <div class="login-prompt-text">
        Conecta con Google para poder usar gratis la app
      </div>
      <LoginButton />
    </div>
  {/if}
  
  <div class="image-container">
    <div class="image-display">
      {#if generatedImage}
        <div class="image-wrapper">
          <img src={generatedImage} alt="Imagen generada" />
          <button class="download-btn" on:click={downloadImage} title="Descargar imagen">
            ⬇️
          </button>
        </div>
      {:else}
        <p>La imagen aparecerá aquí</p>
      {/if}
    </div>
  </div>
  </div>
</main>
