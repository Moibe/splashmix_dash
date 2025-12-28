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
  
  const SPACE_URL = 'https://black-forest-labs-flux-2-dev.hf.space'
  
  // Limpiar imagen y texto cuando cierra sesión
  $: if (!$user) {
    generatedImage = null
    textContent = ''
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
      error = 'Necesitas iniciar sesión'
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
  main {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
    padding: 2rem;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    margin-bottom: 2rem;
  }
  
  h1 { color: #2563eb; margin: 0; font-size: 2rem; }
  
  .text-area-container {
    margin: 2rem 0;
    display: flex;
    justify-content: center;
  }
  
  textarea {
    width: 100%;
    max-width: 600px;
    min-height: 40px;
    padding: 1rem;
    border: 2px solid #ff3e00;
    border-radius: 8px;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto;
    font-size: 1rem;
    resize: vertical;
  }
  
  textarea:disabled {
    background-color: #e0e0e0;
    color: #999;
    cursor: not-allowed;
    border-color: #ccc;
  }
  
  textarea:focus {
    outline: none;
    border-color: #ff6040;
    box-shadow: 0 0 0 3px rgba(255, 62, 0, 0.1);
  }
  
  textarea:disabled:focus {
    box-shadow: none;
  }
  
  .button-container {
    margin: 1.5rem 0;
    display: flex;
    justify-content: center;
  }
  
  .create-button {
    background: #2196F3;
    color: white;
    border: none;
    padding: 0.7rem 2rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
  }
  
  .create-button:hover {
    background: #1976D2;
  }
  
  .create-button:disabled {
    background: #ccc;
    color: #999;
    cursor: not-allowed;
  }
  
  .create-button:disabled:hover {
    background: #ccc;
  }
  
  .image-container {
    margin-top: 3rem;
    display: flex;
    justify-content: center;
    min-height: 300px;
  }
  
  .image-display {
    width: 100%;
    max-width: 600px;
    padding: 1.5rem;
    border: 2px dashed #ff3e00;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f9f9f9;
    color: #999;
    text-align: center;
  }
  
  .image-display img {
    width: 100%;
    height: auto;
    border-radius: 4px;
    color: #333;
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
    background: #ffebee;
    color: #c62828;
    border: 1px solid #ef5350;
    border-radius: 4px;
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
  <div class="header">
    <div>
      <h1>Splashmix - Generador de Imágenes</h1>
      <p>Escribe un prompt y genera imágenes</p>
    </div>
    <LoginButton />
  </div>
  
  <div class="text-area-container">
    <textarea disabled={!$user} bind:value={textContent} placeholder="Escribe lo que quieres crear aquí, por ejemplo: Un astronauta flotando en el espacio."></textarea>
  </div>
  
  <div class="button-container">
    <button class="create-button" disabled={!$user || isLoading} on:click={generateImage}>
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
</main>
