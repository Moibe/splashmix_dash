<script>
  import LoginButton from './lib/LoginButton.svelte'
  import LanguageSwitcher from './lib/LanguageSwitcher.svelte'
  import { user } from './lib/authStore'
  import { auth } from './lib/firebase'
  import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
  import { Client, handle_file } from '@gradio/client'
  import { onMount } from 'svelte'
  import { revisorCuotas, actualizarCuotaDespuesDeGenerar, marcarProveedorSinCuota, incrementarUsos, restarCredito, registrarGeneracionEnAPI, registrarErrorEnAPI, incrementarExplicitCounter, incrementarCounterPersonaje, getUserDocRefByUid, actualizarRitmo, actualizarUltimoUso, guardarCalificacion, asegurarCamposUsuario, limpiarCamposDebug, actualizarEstahora, evaluarActionCall, crearSesionPago, obtenerPrecioActual, marcarClickBuy, marcarCancelBuy, cargarConfiguracionStripe, escucharConfiguracionVerbose } from './lib/firebase'
  import { detectarEstilos } from './lib/openaiStyleDetector'
  import { getRandomAdvice } from './lib/adviceTexts'
  import { t, locale } from 'svelte-i18n'
  import { getLanguageByCountry } from './lib/countryLanguageMap'
  import { getDoc } from 'firebase/firestore'
  
  // Cargar configuraciones al iniciar la aplicación
  onMount(async () => {
    await cargarConfiguracionStripe()
    
    // Escuchar verbosidad en tiempo real desde Firestore
    escucharConfiguracionVerbose((verboseProd, verboseDev) => {
      const shouldDisable = isDev ? !verboseDev : !verboseProd
      originalConsoleLog(`🔧 Verbosidad: modo=${isDev ? 'DEV' : 'PROD'}, verbose-prod=${verboseProd}, verbose-dev=${verboseDev} → logs ${shouldDisable ? 'DESACTIVADOS' : 'ACTIVADOS'}`)
      if (shouldDisable) {
        console.log = () => {}
        console.warn = () => {}
      } else {
        console.log = originalConsoleLog
        console.warn = originalConsoleWarn
      }
    })
  })
  
  let name = 'Svelte Moibe'
  let textContent = ''
  let textareaElement = null // Referencia al textarea del DOM
  let generatedImage = null
  let isLoading = false
  let error = null
  let progress = 0
  let progressInterval = null
  let seedInput = '182'
  let randomizeSeed = false
  let lastSeed = null
  let showFullImage = false
  let showFullFaceIDImage = false
  let selectedProvider = null
  let providerInfo = null
  let showLoginPrompt = false
  let showToast = false
  let toastMessage = $t('toasts.creatingImage')
  let showToastClassification = false
  let toastClassification = ''
  
  function handleTextareaKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
    }
  }
  let showToastEstilos = false
  let toastEstilos = ''
  let showToastCaravaggio = false
  let toastCaravaggio = ''
  let estadoCaravaggio = 'sin estilo agregado' // Rastrear si se agregó Caravaggio
  let lastClassification = null // Almacenar clasificación para usar en registro de API
  let lastEstilos = [] // Almacenar estilos detectados para usar en registro
  let originalPrompt = '' // Almacenar prompt original sin modificaciones
  let showRating = false // Mostrar componente de calificación
  let showAdvice = false // Mostrar recuadro de consejos
  let userRating = 0 // Calificación del usuario (1-5)
  let hoveredRating = 0 // Estrella que está siendo hoveada
  let lastId = null // Almacenar ID de registro para guardar calificación después
  let currentAdvice = '' // Consejo aleatorio
  let fieldsCleaned = false // Flag para asegurar que se ejecuta solo una vez
  let showActionCallModal = false // Mostrar modal de action_call
  let showWelcomeModal = false // Mostrar modal de bienvenida
  let modalPrice = null // Precio dinámico según país para la modal
  let loadingPayment = false // Mostrar spinner de carga en el botón de comprar
  // 🏷️ BANDERA DE PESTAÑAS: Cambiar a false para ocultar pestañas y mostrar solo sección "Imagen"
  let showTabs = false // Controla si se muestran las pestañas o solo la sección default
  let activeTab = 'generate' // 'generate' o 'newTab'
  let uploadedImage = null // Imagen facial cargada por el usuario
  let uploadedPoseImage = null // Imagen de pose cargada por el usuario
  let faceIDGeneratedImage = null // Imagen generada con Face ID

  // Cuando las pestañas están ocultas, forzar la sección default (Imagen)
  $: if (!showTabs && activeTab !== 'generate') {
    activeTab = 'generate'
  }

  // Asegurar campos de usuario cuando ingresa o inicia sesión (una sola vez)
  $: if ($user && !fieldsCleaned) {
    fieldsCleaned = true
    asegurarCamposUsuario($user.uid).catch(err => {
      console.warn('⚠️ Error asegurando campos al cargar:', err)
    })
    limpiarCamposDebug($user.uid).catch(err => {
      console.warn('⚠️ Error limpiando campos de debug:', err)
    })
  }

  // Obtener precio cuando se abre el modal
  $: if (showActionCallModal && $user) {
    obtenerPrecioActual($user.uid).then(priceInfo => {
      if (priceInfo) {
        modalPrice = priceInfo
      }
    })
  }

  // Mostrar modal de bienvenida apenas carga la página
  let welcomeShownInSession = false
  $: if (!welcomeShownInSession && !sessionStorage.getItem('welcomeShown')) {
    showWelcomeModal = true
    welcomeShownInSession = true
  }

  async function handleGoogleLoginFromWelcome() {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      showWelcomeModal = false
      sessionStorage.setItem('welcomeShown', 'true')
    } catch (err) {
      console.error('Error al autenticarse:', err)
    }
  }

  let showLanguageToast = false // Mostrar toast de idioma seleccionado
  let languageToastMessage = '' // Mensaje del toast de idioma
  let userLanguageSet = false // Rastrear si ya se estableció el idioma del usuario
  
  const SPACE_URL = 'https://black-forest-labs-flux-2-dev.hf.space'
  const FACEID_SPACE_URL = 'https://moibe-instantid2.hf.space'
  const FACEID_API = '/faceid-api'  // Proxy para evitar CORS
  const isDev = import.meta.env.DEV
  
  // ⚙️ Configuración: Bandera para mostrar toast de clasificación en producción
  const showClassificationToastInProd = false // Cambiar a true para ver el toast en producción
  
  // Wrapper para console.log que respeta las banderas de Firestore (VERBOSE_PROD/VERBOSE_DEV)
  const originalConsoleLog = console.log
  const originalConsoleWarn = console.warn
  const originalConsoleError = console.error

  // En producción, deshabilitar logs INMEDIATAMENTE (antes de que cualquier código logee)
  // Solo se rehabilitarán si Firestore dice verbose-prod=true
  if (!isDev) {
    console.log = () => {}
    console.warn = () => {}
  }

  // Detectar idioma cuando el usuario se loguea
  $: if ($user && !userLanguageSet) {
    detectUserLanguage()
  }

  async function detectUserLanguage() {
    try {
      const userDocRef = await getUserDocRefByUid($user.uid)
      if (userDocRef) {
        const userDocSnap = await getDoc(userDocRef)
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data()
          const country = userData.country_header || userData.country_ip
          if (country) {
            const detectedLanguage = getLanguageByCountry(country)
            locale.set(detectedLanguage)
            localStorage.setItem('locale', detectedLanguage)
            
            // Mostrar toast
            const langName = detectedLanguage === 'es' ? 'Español' : 'English'
            languageToastMessage = `🌍 Idioma: ${langName} (${country})`
            showLanguageToast = true
            setTimeout(() => { showLanguageToast = false }, 3000)
            
            console.log(`🌍 Idioma detectado: ${detectedLanguage} (País: ${country})`)
          }
        }
      }
      userLanguageSet = true
    } catch (error) {
      console.warn('⚠️ Error detectando idioma:', error)
      userLanguageSet = true
    }
  }

  // Close fullscreen modal via keyboard for accessibility
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      if (showFullImage) {
        showFullImage = false
      } else if (showFullFaceIDImage) {
        showFullFaceIDImage = false
      }
    }
  }

  if (!isDev) {
    // En producción, también usar seed 182 por defecto
    seedInput = '182'
    randomizeSeed = false
  }

  // Detectar GA Client al cargar la app (con o sin usuario logueado)
  const gaClient = window.gaGlobal?.vid || null
  if (gaClient) {
    console.log('📊 GA Client detectado:', gaClient)
  } else {
    console.warn('⚠️ GA Client NO detectado')
  }
  
  // Mostrar último request a Kraken si existe en sessionStorage
  const lastKrakenRequest = sessionStorage.getItem('lastKrakenRequest')
  if (lastKrakenRequest) {
    try {
      const request = JSON.parse(lastKrakenRequest)
      console.log('📋 ═════════════════════════════════════════════════════')
      console.log('📋 ÚLTIMO REQUEST ENVIADO A STRIPE KRAKEN')
      console.log('📋 ═════════════════════════════════════════════════════')
      console.log(request)
      console.log('📋 ═════════════════════════════════════════════════════')
      console.log('💡 Puedes copiar el objeto anterior desde la consola')
      // Limpiar después de mostrar
      sessionStorage.removeItem('lastKrakenRequest')
    } catch (e) {
      console.warn('⚠️ Error leyendo lastKrakenRequest:', e)
    }
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
  function parseSeed(value) {
    if (value === '' || value === null || value === undefined) return null
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed
    }
    return null
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

  function downloadFaceIDImage() {
    if (!faceIDGeneratedImage) return
    
    // Obtener la imagen como blob y descargar
    fetch(faceIDGeneratedImage)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `splashmix-faceid-${Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        console.log('⬇️ Imagen Face ID descargada')
      })
      .catch(err => {
        console.error('❌ Error descargando imagen Face ID:', err)
      })
  }

  async function irAComprar() {
    if (!$user) {
      console.warn('⚠️ Usuario no autenticado')
      showLoginPrompt = true
      return
    }

    console.log('🛒 Iniciando compra para usuario:', $user.uid)
    
    // Mostrar spinner inmediatamente
    loadingPayment = true
    
    // Registrar click en background
    marcarClickBuy($user.uid)
    
    try {
      const paymentLink = await crearSesionPago($user.uid)
      
      if (paymentLink) {
        console.log('🔗 Redirigiendo a:', paymentLink)
        // El spinner sigue girando mientras se redirige, no detener el loading
        window.location.href = paymentLink
      } else {
        console.error('❌ No se pudo obtener el link de pago')
        loadingPayment = false
        toastMessage = $t('toasts.paymentError')
        showToast = true
        setTimeout(() => { showToast = false }, 3000)
      }
    } catch (error) {
      loadingPayment = false
      console.error('❌ Error en irAComprar:', error)
      toastMessage = $t('toasts.paymentError')
      showToast = true
      setTimeout(() => { showToast = false }, 3000)
    }
  }

  function handleImageUpload(event) {
    const file = event.target.files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        uploadedImage = e.target.result
      }
      reader.readAsDataURL(file)
    } else {
      toastMessage = $t('toasts.invalidImage')
      showToast = true
      setTimeout(() => { showToast = false }, 3000)
    }
  }

  function handlePoseImageUpload(event) {
    const file = event.target.files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        uploadedPoseImage = e.target.result
      }
      reader.readAsDataURL(file)
    } else {
      toastMessage = $t('toasts.invalidImage')
      showToast = true
      setTimeout(() => { showToast = false }, 3000)
    }
  }

  // Función para verificar si el Space está accesible
  async function verificarSpaceAccesible(spaceUrl) {
    try {
      console.log('🔍 Verificando accesibilidad del Space:', spaceUrl)
      
      // 1. Verificar que la URL base responde
      const baseResponse = await fetch(spaceUrl, { method: 'GET' })
      console.log('✅ Space base URL responde:', baseResponse.status)
      
      // 2. Intentar obtener info del Space (endpoint estándar de Gradio)
      try {
        const infoResponse = await fetch(`${spaceUrl}/info`, { method: 'GET' })
        if (infoResponse.ok) {
          const info = await infoResponse.json()
          console.log('📋 Info del Space:', info)
          console.log('📋 Endpoints disponibles:', info.named_endpoints || 'No listados')
          return { ok: true, info: info }
        }
      } catch (infoError) {
        console.warn('⚠️ No se pudo obtener /info del Space')
      }
      
      return { ok: true, info: null }
    } catch (error) {
      console.error('❌ Space NO accesible:', error.message)
      return { ok: false, error: error.message }
    }
  }

  async function handleFaceIDGeneration() {
    // Validar que haya imagen de cara cargada
    if (!uploadedImage) {
      toastMessage = $t('toasts.faceImageRequired')
      showToast = true
      setTimeout(() => { showToast = false }, 3000)
      return
    }

    // Validar que haya imagen de pose cargada
    if (!uploadedPoseImage) {
      toastMessage = $t('toasts.poseImageRequired')
      showToast = true
      setTimeout(() => { showToast = false }, 3000)
      return
    }

    // Validar que haya texto de prompt
    if (!textContent.trim()) {
      toastMessage = $t('toasts.promptRequired')
      showToast = true
      setTimeout(() => { showToast = false }, 3000)
      return
    }

    // Validar que el usuario esté logueado
    if (!$user) {
      showLoginPrompt = true
      return
    }

    isLoading = true
    faceIDGeneratedImage = null
    error = null

    try {
      console.log('🎭 Iniciando generación Face ID...')
      console.log('📝 Prompt:', textContent.trim())

      // Convertir las imágenes base64 a Blobs para subirlas
      const faceResponse = await fetch(uploadedImage);
      const faceBlob = await faceResponse.blob();
      
      const poseResponse = await fetch(uploadedPoseImage);
      const poseBlob = await poseResponse.blob();

      if (!faceBlob || faceBlob.size === 0) {
        throw new Error('No se pudo crear el blob de la imagen facial.')
      }
      if (!poseBlob || poseBlob.size === 0) {
        throw new Error('No se pudo crear el blob de la imagen de pose.')
      }
      console.log(`✅ Blob facial creado: ${faceBlob.size} bytes (${faceBlob.type})`)
      console.log(`✅ Blob de pose creado: ${poseBlob.size} bytes (${poseBlob.type})`)

      let attempt = 0;
      const maxAttempts = 8;
      let generationSuccess = false;
      let lastError = null;
      let imageUrl = null;
      let selectedProvider = null;
      let providerInfo = null;

      while (attempt < maxAttempts && !generationSuccess) {
        attempt += 1
        imageUrl = null
        providerInfo = await revisorCuotas()
        selectedProvider = providerInfo.proveedor
        const hfToken = providerInfo.token

        console.log(`🔄 Intento ${attempt}/${maxAttempts}`)
        console.log(`✅ Proveedor seleccionado: ${providerInfo.proveedor}`)

        try {
          console.log('🔗 Conectando a InstantID2 via proxy...')
          
          // === PASO 1: Subir imágenes al Space ===
          console.log('📁 Subiendo imágenes al Space...')
          const formData = new FormData()
          formData.append('files', faceBlob, 'face.png')
          formData.append('files', poseBlob, 'pose.png')
          
          const uploadResponse = await fetch(`${FACEID_API}/gradio_api/upload`, {
            method: 'POST',
            headers: hfToken ? { 'Authorization': `Bearer ${hfToken}` } : {},
            body: formData
          })
          
          if (!uploadResponse.ok) {
            throw new Error(`Error subiendo imágenes: ${uploadResponse.status}`)
          }
          
          const uploadedFiles = await uploadResponse.json()
          console.log('✅ Imágenes subidas:', uploadedFiles)
          // Gradio devuelve: ["/tmp/gradio/...", "/tmp/gradio/..."]
          const uploadedFacePath = uploadedFiles[0]
          const uploadedPosePath = uploadedFiles[1] || uploadedFiles[0]  // Usar segunda imagen o la misma
          
          // === PASO 2: Llamar al endpoint de predicción con el path del servidor ===
          console.log('📤 Enviando request a /generate_image...')
          const predictResponse = await fetch(`${FACEID_API}/gradio_api/call/generate_image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(hfToken ? { 'Authorization': `Bearer ${hfToken}` } : {})
            },
            body: JSON.stringify({
              data: [
                { path: uploadedFacePath, meta: { _type: "gradio.FileData" } }, // face_image_path
                { path: uploadedPosePath, meta: { _type: "gradio.FileData" } }, // pose_image_path
                textContent.trim(),
                // "(lowres, low quality, worst quality:1.2), (text:1.2), watermark, (frame:1.2), deformed, ugly, deformed eyes, blur, out of focus, blurry, deformed cat, deformed, photo, anthropomorphic cat, monochrome, photo, pet collar, gun, weapon, blue, 3d, drones, drone, buildings in background, green",
                "",  // negative_prompt (comentado - usar line anterior si lo necesitas)
                "(No style)",   // style_name
                30,             // num_steps
                0.8,            // identitynet_strength_ratio
                0.8,            // adapter_strength_ratio
                0.4,            // canny_strength
                0.4,            // depth_strength
                ["depth"],      // controlnet_selection
                5,              // guidance_scale
                Math.floor(Math.random() * 2147483647), // seed
                "EulerDiscreteScheduler",               // scheduler
                false,          // enable_LCM
                true            // enhance_face_region
              ]
            })
          })
          
          if (!predictResponse.ok) {
            const errText = await predictResponse.text()
            throw new Error(`Error en predicción: ${predictResponse.status} - ${errText}`)
          }
          
          const predictResult = await predictResponse.json()
          const eventId = predictResult.event_id
          console.log('✅ Predicción iniciada, event_id:', eventId)
          
          // === PASO 3: Obtener resultado (SSE polling) ===
          console.log('⏳ Esperando resultado...')
          const resultResponse = await fetch(`${FACEID_API}/gradio_api/call/generate_image/${eventId}`, {
            headers: hfToken ? { 'Authorization': `Bearer ${hfToken}` } : {}
          })
          
          if (!resultResponse.ok) {
            throw new Error(`Error obteniendo resultado: ${resultResponse.status}`)
          }
          
          const resultText = await resultResponse.text()
          console.log('📦 Respuesta SSE:', resultText)
          
          // Parsear respuesta SSE para encontrar el evento "process_completed" o "complete"
          // El formato es stream, así que pueden llegar múltiples líneas y eventos
          const lines = resultText.split('\n')
          let resultData = null
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6))
                // Si data es un array y tiene elementos, asumimos que es el resultado final
                // (los eventos intermedios "generating" suelen tener otro formato o null)
                if (Array.isArray(data) && data.length > 0) {
                   resultData = data
                   // No hacemos break por si hay más líneas posteriores con el resultado final
                }
              } catch (e) {
                console.warn('⚠️ No se pudo parsear línea:', line)
              }
            }
          }
          
          console.log('📦 Resultado final seleccionado:', resultData)

          // Extraer URL de la imagen
          if (resultData && Array.isArray(resultData) && resultData.length > 0) {
            // El resultado suele ser [ { image: { path: "..." } }, ... ] o [ { path: "..." } ]
            // O a veces [ "ruta/temporal" ]
            const item = resultData[0]
            
            console.log('🔍 Inspeccionando item 0:', item)

            if (item && item.url) {
              imageUrl = item.url.replace(FACEID_SPACE_URL, FACEID_API)
            } else if (item && item.path) {
              imageUrl = `${FACEID_API}/gradio_api/file=${item.path}`
            } else if (item && item.image && item.image.path) {
              // Estructura anidada común en algunos componentes
              imageUrl = `${FACEID_API}/gradio_api/file=${item.image.path}`
            } else if (item && item.image && item.image.url) {
              imageUrl = item.image.url.replace(FACEID_SPACE_URL, FACEID_API)
            } else if (typeof item === 'string' && item.startsWith('/')) {
              // Ruta absoluta temporal
              imageUrl = `${FACEID_API}/gradio_api/file=${item}`
            } else if (typeof item === 'string' && item.startsWith('http')) {
              imageUrl = item.replace(FACEID_SPACE_URL, FACEID_API)
            }
          }

          if (!imageUrl) {
            throw new Error('No se obtuvo URL de imagen del Space')
          }

          generationSuccess = true

        } catch (attemptError) {
          const message = attemptError?.message || ''
          const lowered = typeof message === 'string' ? message.toLowerCase() : ''
          const quotaExceeded = lowered.includes('pro gpu quota') || lowered.includes('free gpu quota')

          if (quotaExceeded && selectedProvider && selectedProvider !== 'costo') {
            await marcarProveedorSinCuota(selectedProvider)
            console.warn(`⚠️ Proveedor sin GPU disponible (${selectedProvider}), reintentando...`)
            lastError = attemptError
            imageUrl = null
            continue
          }

          throw attemptError
        }
      }

      if (!generationSuccess || !imageUrl) {
        throw lastError || new Error('No se pudo generar la imagen después de múltiples intentos')
      }

      // Actualizar cuota del proveedor
      if (selectedProvider && selectedProvider !== 'costo') {
        await actualizarCuotaDespuesDeGenerar(selectedProvider, providerInfo.quotaDisponible)
      }

      // Mostrar imagen generada
      faceIDGeneratedImage = imageUrl
      console.log('✅ Imagen Face ID generada:', imageUrl)

      toastMessage = $t('toasts.faceIdGenerated')
      showToast = true
      setTimeout(() => { showToast = false }, 3000)

      // Actualizar contadores del usuario
      await restarCredito($user)
      await incrementarUsos($user)
      await actualizarRitmo($user)
      await actualizarEstahora($user.uid)
      await evaluarActionCall($user.uid)

    } catch (error) {
      console.error('❌ Error generando Face ID:', error)
      toastMessage = $t('toasts.generationError') + (error?.message || 'Error desconocido')
      showToast = true
      setTimeout(() => { showToast = false }, 5000)
    } finally {
      isLoading = false
    }
  }
  
  async function generateImage() {
    // Leer el valor directamente del textarea en el DOM
    if (textareaElement) {
      textContent = textareaElement.value
    }
    
    if (!textContent.trim()) {
      error = $t('messages.writeFirst')
      return
    }
    
    if (!$user) {
      showLoginPrompt = true
      return
    }

    // Checar action_call
    try {
      const userDocRef = await getUserDocRefByUid($user.uid)
      if (userDocRef) {
        const userDocSnap = await getDoc(userDocRef)
        if (userDocSnap.exists()) {
          const actionCall = userDocSnap.data().action_call || false
          if (actionCall === true) {
            showActionCallModal = true
            return
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ Error verificando action_call:', err)
    }
    
    // Cerrar rating y consejos cuando se inicia una nueva generación
    showRating = false
    showAdvice = false
    showToast = true
    const hasOpenAI = !!import.meta.env.VITE_OPENAI_API_KEY
    if (hasOpenAI) {
      toastMessage = $t('toasts.analyzing')
    } else {
      toastMessage = $t('toasts.classifierUnavailable')
    }
    error = null
    progress = 0
    
    // Inicia animación de barra de progreso
    progressInterval = setInterval(() => {
      progress += Math.random() * (progress < 80 ? 16 : 0.5)
      if (progress > 99) progress = 99
    }, 100)
    
    isLoading = true
    
    try {
      console.log('🎨 Generando imagen con prompt:', textContent)

      // Limpiar prompt: remover saltos de línea y espacios extra
      let cleanedPrompt = textContent.replace(/\n/g, ' ').trim()
      originalPrompt = cleanedPrompt // Guardar el prompt original antes de modificarlo

      // Clasificar el prompt con OpenAI (no bloquea la generación)
      if (hasOpenAI) {
        import('./lib/openaiClassifier').then(async (m) => {
          try {
            const { classifyPrompt, summarizeLabels } = m
            const cls = await classifyPrompt(textContent)
            if (cls.ok) {
              lastClassification = cls // Guardar clasificación para usar en registro
              const summary = summarizeLabels(cls.labels)
              toastClassification = $t('evaluation.promptType') + summary
              console.log('✅ Clasificación:', cls.labels, '| Razones:', cls.reasons)
            } else {
              toastClassification = $t('evaluation.classifierError')
              console.warn('Clasificación fallida:', cls.error || 'sin detalle')
            }
            // Mostrar toast en dev o si está habilitado en prod
            if (isDev || showClassificationToastInProd) {
              showToastClassification = true
              setTimeout(() => { showToastClassification = false }, 4000)
            }
            showToast = false // Ocultar el toast inicial "Analizando prompt"
          } catch (e) {
            toastClassification = $t('evaluation.classifierError')
            console.warn('Clasificación error:', e?.message)
            // Mostrar toast en dev o si está habilitado en prod
            if (isDev || showClassificationToastInProd) {
              showToastClassification = true
              setTimeout(() => { showToastClassification = false }, 4000)
            }
            showToast = false // Ocultar el toast inicial "Analizando prompt"
          }
        })

        // Detectar estilos artísticos
        import('./lib/openaiStyleDetector').then(async (m) => {
          try {
            const { detectarEstilos } = m
            console.log('🎨 DETECCIÓN DE ESTILOS INICIADA')
            console.log('📝 Prompt:', cleanedPrompt)
            const estilosDetectados = await detectarEstilos(cleanedPrompt)
            console.log('🎨 Resultado de detección:', estilosDetectados)
            if (estilosDetectados.ok) {
              lastEstilos = estilosDetectados.estilos // Guardar para usar en registro
              console.log('💾 lastEstilos guardado:', lastEstilos)
              if (estilosDetectados.estilos.length > 0) {
                toastEstilos = $t('evaluation.styles') + estilosDetectados.estilos.join(', ')
                console.log('✅ Estilos encontrados:', estilosDetectados.estilos)
                estadoCaravaggio = 'sin estilo agregado' // El usuario escribió el estilo, no fue automático
              } else {
                toastEstilos = $t('evaluation.noStyles')
                console.log('ℹ️ Sin estilos detectados')
                // Si no hay estilos, 50% de probabilidad de agregar "al estilo Caravaggio"
                if (Math.random() < 0.5) {
                  cleanedPrompt = cleanedPrompt + ' al estilo Caravaggio'
                  estadoCaravaggio = 'Caravaggio'
                  toastCaravaggio = $t('evaluation.caravaggioDynamic')
                  console.log('🎨 Estilo automático agregado: Caravaggio')
                  console.log('📝 Prompt modificado:', cleanedPrompt)
                } else {
                  estadoCaravaggio = 'sin estilo agregado'
                  toastCaravaggio = $t('evaluation.noAutoStyle')
                  console.log('ℹ️ Sin estilo Caravaggio agregado (probabilidad no cumplida)')
                }
                showToastCaravaggio = true
                setTimeout(() => { showToastCaravaggio = false }, 4000)
              }
              console.log('📤 Toast estilos:', toastEstilos)
            } else {
              console.warn('⚠️ Error en detección de estilos')
              toastEstilos = $t('evaluation.styleDetectionError')
            }
            showToastEstilos = true
            showToast = false // Ocultar el toast inicial "Analizando prompt"
            setTimeout(() => { showToastEstilos = false }, 4000)
          } catch (e) {
            console.warn('⚠️ Error en detección de estilos:', e?.message)
            toastEstilos = '⚠️ Error detectando estilos'
            showToastEstilos = true
            showToast = false // Ocultar el toast inicial "Analizando prompt"
            setTimeout(() => { showToastEstilos = false }, 4000)
          }
        })
      } else {
        console.info('ℹ️ OpenAI no disponible, se omite la clasificación y detección de estilos')
      }
      
      // Determinar seed una vez y reutilizar para cada intento
      let explicitSeed = null
      explicitSeed = parseSeed(seedInput)
      if (explicitSeed === null) {
        randomizeSeed = true
      }
      const useRandom = randomizeSeed || explicitSeed === null
      if (!useRandom && explicitSeed !== null) {
        console.log('🎯 Seed solicitada:', explicitSeed)
      }

      const maxAttempts = 8
      let attempts = 0
      let generationSuccess = false
      let lastError = null
      let imageUrl = null
      let seed = null

      while (attempts < maxAttempts && !generationSuccess) {
        attempts += 1
        imageUrl = null
        seed = null
        providerInfo = await revisorCuotas()
        selectedProvider = providerInfo.proveedor
        const hfToken = providerInfo.token

        console.log(`✅ Proveedor seleccionado: ${providerInfo.proveedor}`)
        console.log(`📊 Cuota disponible: ${providerInfo.quotaDisponible} segundos`)
        console.log('🔑 Token:', hfToken ? `✅ Presente (${hfToken.slice(0, 10)}...)` : '❌ No encontrado')
        console.log('🔐 Token completo para verificación:', hfToken)

        try {
          console.log('🔗 Conectando a Space:', SPACE_URL)
          console.log('📤 Parámetros de conexión:', { token: hfToken ? '✅ Presente' : '❌ No encontrado' })
          const client = await Client.connect(SPACE_URL, { token: hfToken })
          console.log('✅ Conexión exitosa al Space')

          const result = await client.predict('/infer', {
            prompt: cleanedPrompt,
            input_images: [],
            seed: useRandom ? 0 : explicitSeed,
            randomize_seed: useRandom,
            width: 1024,
            height: 1024,
            num_inference_steps: 30,
            guidance_scale: 4,
            prompt_upsampling: false
          })

          console.log('📦 Respuesta del Space:', result)

          if (result.data && Array.isArray(result.data)) {
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

          generationSuccess = true
        } catch (attemptError) {
          const message = attemptError?.message || ''
          const lowered = typeof message === 'string' ? message.toLowerCase() : ''
          const quotaExceeded = lowered.includes('pro gpu quota') || lowered.includes('free gpu quota')

          if (quotaExceeded && selectedProvider && selectedProvider !== 'costo') {
            await marcarProveedorSinCuota(selectedProvider)
            console.warn(`⚠️ Proveedor sin GPU disponible (${selectedProvider}), reintentando...`)
            lastError = attemptError
            imageUrl = null
            seed = null
            continue
          }

          throw attemptError
        }
      }

      if (!generationSuccess) {
        throw lastError || new Error('No fue posible generar la imagen con los proveedores disponibles')
      }

      generatedImage = imageUrl
      showFullImage = false
      showRating = true // Mostrar componente de calificación
      showAdvice = true // Mostrar recuadro de consejos
      userRating = 0 // Resetear calificación
      currentAdvice = getRandomAdvice() // Obtener consejo aleatorio
      // El ID se asignará cuando la API retorne el id del registro
      console.log('✅ Imagen generada. URL:', imageUrl)
      console.log('🔑 Seed usado:', seed)
      lastSeed = seed ?? null
      if (isDev && !useRandom && explicitSeed !== null && seed !== explicitSeed) {
        console.warn('⚠️ Seed devuelta difiere de la solicitada:', explicitSeed, '->', seed)
      }
      if (isDev && !useRandom && explicitSeed !== null && seed === explicitSeed) {
        seedInput = explicitSeed.toString()
      }
      progress = 100

      console.log('📝 Logs archivados en MariaDB...')

      console.log('📊 Incrementando contador de usos...')
      await incrementarUsos($user)

      console.log('� Restando crédito al usuario...')
      await restarCredito($user)

      console.log('�🔄 Actualizando cuota del proveedor...')
      await actualizarCuotaDespuesDeGenerar(providerInfo.proveedor, providerInfo.quotaDisponible)

      console.log('📊 Actualizando ritmo en Firestore...')
      await actualizarRitmo($user)

      console.log('⏰ Actualizando último uso...')
      await actualizarUltimoUso($user)

      console.log('⏰ Actualizando contador de generaciones esta hora...')
      await actualizarEstahora($user.uid)

      console.log('🔍 Evaluando umbrales de action_call...')
      await evaluarActionCall($user.uid)

      // Verificar si la clasificación incluye "explicit" e incrementar contador
      if (lastClassification && lastClassification.ok && lastClassification.labels && lastClassification.labels.includes('explicit')) {
        console.log('⚠️ Prompt explícito detectado, incrementando contador...')
        await incrementarExplicitCounter($user)
        
        // Verificar si explicit_counter > 3 para mostrar advertencia
        try {
          const userDocRef = await getUserDocRefByUid($user.uid)
          if (userDocRef) {
            const userDocSnap = await getDoc(userDocRef)
            if (userDocSnap.exists()) {
              const explicitCount = userDocSnap.data().explicit_counter || 0
              if (explicitCount > 3) {
                toastMessage = $t('toasts.explicitCounterHigh')
                showToast = true
                setTimeout(() => { showToast = false }, 3000)
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ Error verificando explicit_counter:', error)
        }
      }
      
      // Verificar si la clasificación incluye "specific_character" e incrementar contador
      if (lastClassification && lastClassification.ok && lastClassification.labels && lastClassification.labels.includes('specific_character')) {
        console.log('👤 Prompt de personaje específico detectado, incrementando contador...')
        await incrementarCounterPersonaje($user)
      }

      // Registrar generación en MariaDB
      console.log('📊 Registrando en MariaDB...')
      console.log('🎨 lastEstilos al registrar:', lastEstilos)
      console.log('🎨 estadoCaravaggio:', estadoCaravaggio)
      const registroResult = await registrarGeneracionEnAPI($user, originalPrompt, seed, providerInfo.proveedor, lastClassification, lastEstilos, estadoCaravaggio)
      if (registroResult.ok && registroResult.id) {
        lastId = registroResult.id
        console.log('📝 ID de registro guardado:', lastId)
      }
      
    } catch (err) {
      console.error('❌ Error generando imagen:', err)
      error = 'Error al generar la imagen: ' + (err.message || 'Intenta de nuevo')
      generatedImage = null
      const errLower = typeof err?.message === 'string' ? err.message.toLowerCase() : ''
      const quotaExceeded = errLower.includes('pro gpu quota') || errLower.includes('free gpu quota')
      if (quotaExceeded && selectedProvider && selectedProvider !== 'costo') {
        await marcarProveedorSinCuota(selectedProvider)
      }
      
      // Guardar log de error en MariaDB
      if ($user && selectedProvider) {
        await registrarErrorEnAPI($user, cleanedPrompt, err.message, selectedProvider)
      }
    } finally {
      clearInterval(progressInterval)
      isLoading = false
      progress = 0
      // Ocultar toast unos segundos después de terminar
      setTimeout(() => { showToast = false }, 2500)
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

  .toast {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: white;
    color: #333;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 999;
    animation: slideInRight 0.3s ease;
    font-weight: 500;
  }

  .toast-classification {
    bottom: 5.5rem;
    right: 2rem;
  }

  .toast-estilos {
    bottom: 9rem;
    right: 2rem;
  }

  .toast-caravaggio {
    bottom: 12.5rem;
    right: 2rem;
  }

  .toast-language {
    bottom: 16rem;
    right: 2rem;
  }

  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .rating-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;
    z-index: 998;
  }

  .rating-box {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 8px 20px;
    margin-bottom: 20px;
    box-shadow: 0 0 25px rgba(255, 255, 255, 0.9), 0 4px 12px rgba(0, 0, 0, 0.2);
    text-align: center;
    position: relative;
    z-index: 999;
  }

  .rating-title {
    color: #0052cc;
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 2px 0;
  }

  .stars-container {
    display: flex;
    justify-content: center;
    gap: 10px;
  }

  .star {
    background: none;
    border: none;
    font-size: 36px;
    cursor: pointer;
    color: #ddd;
    transition: all 0.2s ease;
    padding: 5px;
    border-radius: 8px;
  }

  .star:hover {
    color: #ffd700;
    transform: scale(1.2);
  }

  .star.filled {
    color: #ffd700;
  }

  .advice-box {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 8px 20px;
    margin-bottom: 20px;
    box-shadow: 0 0 25px rgba(255, 255, 255, 0.9), 0 4px 12px rgba(0, 0, 0, 0.2);
    text-align: center;
    position: relative;
    z-index: 999;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .advice-text {
    color: #0052cc;
    font-size: 14px;
    font-weight: 500;
    margin: 0;
    line-height: 1.4;
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
    gap: 15px;
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

  .seed-container {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 1.5rem;
    width: 100%;
    max-width: 600px;
    margin: -0.5rem auto 1rem auto;
    flex-wrap: wrap;
  }

  .seed-input {
    display: flex;
    flex-direction: column;
    flex: 1 1 220px;
  }

  .seed-label {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 0.4rem;
  }

  .seed-input input {
    padding: 0.7rem 0.9rem;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 1rem;
  }

  .seed-input input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
  }

  .seed-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    font-size: 0.95rem;
  }

  .seed-toggle input {
    width: 18px;
    height: 18px;
  }

  .seed-last {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.75);
  }
  
  textarea {
    width: 100%;
    max-width: 600px;
    min-height: 20px;
    padding: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto;
    font-size: 1rem;
    resize: vertical;
    overflow-y: auto;
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
    max-width: 100%;
    max-height: 100%;
    border-radius: 8px;
    object-fit: contain;
  }

  .image-wrapper {
    position: relative;
    width: 100%;
  }

  .image-actions {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    gap: 8px;
    z-index: 10;
  }

  .action-btn {
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
    color: white;
  }

  .action-btn:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
  }

  .action-btn:active {
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

  .fullscreen-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 2000;
  }

  .fullscreen-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 90vw;
    max-height: 90vh;
    z-index: 2001;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fullscreen-modal img {
    max-width: 100%;
    max-height: 100%;
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  }

  .close-fullscreen {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.7);
    border: none;
    border-radius: 999px;
    width: 40px;
    height: 40px;
    color: white;
    font-size: 1.1rem;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .close-fullscreen:hover {
    background: rgba(0, 0, 0, 0.9);
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  }

  .modal-box {
    background: rgba(255, 255, 255, 0.98);
    border-radius: 16px;
    padding: 40px 30px;
    box-shadow: 0 0 40px rgba(255, 255, 255, 0.95), 0 0 80px rgba(0, 82, 204, 0.4), 0 8px 32px rgba(0, 0, 0, 0.2);
    text-align: center;
    max-width: 500px;
    width: 90%;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.8);
  }

  .modal-box p {
    margin: 0;
    font-size: 32px;
    font-weight: 600;
    background: linear-gradient(135deg, #0052cc 0%, #004999 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: 1px;
    margin-bottom: 20px;
  }

  .modal-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    margin-top: 30px;
    gap: 16px;
  }

  .modal-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .modal-radio {
    width: 20px;
    height: 20px;
    cursor: pointer;
    flex-shrink: 0;
    accent-color: #004999 !important;
    -webkit-appearance: none;
    appearance: none;
    background: white;
    border: 2px solid #004999;
    border-radius: 50%;
    outline: none;
    position: relative;
  }

  .modal-radio:checked {
    background: #004999;
    border-color: #004999;
  }

  .modal-radio:checked::after {
    content: '';
    position: absolute;
    width: 6px;
    height: 6px;
    background: white;
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .modal-title-small {
    font-size: 16px;
    font-weight: 600;
    color: #333;
    white-space: nowrap;
  }

  .modal-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .modal-price-inline {
    font-size: 18px;
    font-weight: 600;
    color: #0052cc;
  }

  .modal-price {
    margin: 0 !important;
    margin-bottom: 20px !important;
    font-size: 24px !important;
    font-weight: 500 !important;
    color: #666 !important;
    background: none !important;
    -webkit-background-clip: unset !important;
    -webkit-text-fill-color: unset !important;
    background-clip: unset !important;
  }

  .modal-buy-btn {
    background: linear-gradient(135deg, #0052cc 0%, #004999 100%);
    border: none;
    color: white;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 15px rgba(0, 82, 204, 0.3);
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 80px;
  }

  .modal-buy-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(0, 82, 204, 0.5);
  }

  .modal-buy-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .modal-buy-btn:disabled {
    opacity: 0.7;
    cursor: wait;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .stripe-security {
    margin-top: 15px;
    margin-bottom: 0;
    font-size: 11px !important;
    color: #888 !important;
    text-align: center;
    font-weight: 400 !important;
    letter-spacing: 0.5px;
    background: none !important;
    -webkit-background-clip: unset !important;
    -webkit-text-fill-color: unset !important;
    background-clip: unset !important;
  }

  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(0, 82, 204, 0.1);
    border: none;
    font-size: 16px;
    cursor: pointer;
    color: #0052cc;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    transition: all 0.2s ease;
    border: 1px solid rgba(0, 82, 204, 0.2);
  }

  .close-btn:hover {
    background: rgba(0, 82, 204, 0.2);
    color: #0052cc;
    transform: scale(1.1);
    box-shadow: 0 0 15px rgba(0, 82, 204, 0.3);
  }

  .welcome-modal {
    max-width: 500px;
  }

  .welcome-title {
    font-size: 28px !important;
    font-weight: 700 !important;
    margin-bottom: 16px !important;
    background: none !important;
    -webkit-background-clip: unset !important;
    -webkit-text-fill-color: unset !important;
    background-clip: unset !important;
    color: #0052cc !important;
    letter-spacing: 0 !important;
  }

  .welcome-text {
    font-size: 16px !important;
    font-weight: 400 !important;
    color: #444 !important;
    line-height: 1.6 !important;
    margin-bottom: 16px !important;
    background: none !important;
    -webkit-background-clip: unset !important;
    -webkit-text-fill-color: unset !important;
    background-clip: unset !important;
    letter-spacing: 0 !important;
  }

  .welcome-subtitle {
    font-size: 16px !important;
    font-weight: 600 !important;
    color: #0052cc !important;
    margin-bottom: 12px !important;
    background: none !important;
    -webkit-background-clip: unset !important;
    -webkit-text-fill-color: unset !important;
    background-clip: unset !important;
    letter-spacing: 0 !important;
  }

  .welcome-text-final {
    font-size: 15px !important;
    font-weight: 400 !important;
    color: #666 !important;
    line-height: 1.5 !important;
    margin-bottom: 24px !important;
    background: none !important;
    -webkit-background-clip: unset !important;
    -webkit-text-fill-color: unset !important;
    background-clip: unset !important;
    letter-spacing: 0 !important;
  }

  .welcome-btn {
    background: linear-gradient(135deg, #0052cc 0%, #004999 100%);
    border: none;
    color: white;
    padding: 12px 40px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 15px rgba(0, 82, 204, 0.3);
  }

  .welcome-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(0, 82, 204, 0.5);
  }

  .welcome-btn:active {
    transform: translateY(0);
  }

  /* Estilos para las pestañas */
  .tabs-container {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin: 20px 0 10px 0;
    padding: 0 20px;
  }

  .tab-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    padding: 8px 20px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    border-bottom: 2px solid transparent;
    position: relative;
  }

  .tab-btn:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  .tab-btn.active {
    color: rgba(255, 255, 255, 1);
    border-bottom: 2px solid rgba(255, 255, 255, 0.8);
  }

  .empty-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
  }

  .empty-text {
    color: rgba(255, 255, 255, 0.5);
    font-size: 16px;
    font-weight: 400;
  }

  /* Layout de dos columnas para nueva pestaña */
  .two-column-layout {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 30px;
    padding: 20px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .upload-column, .preview-column {
    display: flex;
    flex-direction: column;
  }

  .upload-column .button-container {
    margin-top: 20px;
  }

  .upload-area {
    width: 100%;
    flex-shrink: 0;
  }

  .upload-label {
    cursor: pointer;
    display: block;
  }

  .upload-box {
    border: 3px dashed rgba(255, 255, 255, 0.3);
    border-radius: 16px;
    padding: 0.75rem;
    height: 480px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    background: rgba(255, 255, 255, 0.05);
    box-sizing: border-box;
  }

  .upload-box:hover {
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.08);
  }

  .uploaded-preview {
    max-width: 100%;
    max-height: 100%;
    border-radius: 8px;
    object-fit: contain;
  }

  .two-column-layout .image-container {
    margin-top: 0;
    height: 480px;
    flex-shrink: 0;
  }

  .two-column-layout .image-display {
    height: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: 0.75rem;
  }

  .upload-placeholder {
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
  }

  .upload-icon {
    font-size: 64px;
    display: block;
    margin-bottom: 16px;
  }

  .upload-text {
    font-size: 18px;
    margin: 0 0 8px 0;
    font-weight: 500;
  }

  .upload-hint {
    font-size: 14px;
    margin: 0;
    opacity: 0.7;
  }

  .three-column-layout {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    padding: 20px;
    max-width: 1600px;
    margin: 0 auto;
  }

  .column-title {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .three-column-layout .upload-column, .three-column-layout .preview-column {
    display: flex;
    flex-direction: column;
  }

  .three-column-layout .image-container {
    margin-top: 0;
    height: 380px;
    flex-shrink: 0;
    margin-bottom: 16px;
  }

  .three-column-layout .image-display {
    height: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: 0.75rem;
  }

  .three-column-layout .button-container {
    margin-top: auto;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .new-tab-content .button-container {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 20px 0;
    width: 100%;
  }

  .preview-column .progress-bar {
    margin-top: 16px;
  }

  .three-column-layout .upload-box {
    height: 380px;
  }

  @media (max-width: 1200px) {
    .three-column-layout {
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .three-column-layout .preview-column {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 968px) {
    .two-column-layout {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .three-column-layout {
      grid-template-columns: 1fr;
      gap: 20px;
    }
  }
</style>

<svelte:window on:keydown={handleKeydown} />

{#if showToast}
  <div class="toast">{toastMessage}</div>
{/if}

{#if showToastClassification}
  <div class="toast toast-classification">{toastClassification}</div>
{/if}

{#if showToastEstilos}
  <div class="toast toast-estilos">{toastEstilos}</div>
{/if}

{#if showToastCaravaggio}
  <div class="toast toast-caravaggio">{toastCaravaggio}</div>
{/if}

{#if showLanguageToast}
  <div class="toast toast-language">{languageToastMessage}</div>
{/if}

<main>
  <div class="header-top">
    <div class="header-left">
      <a href="https://splashmix.ink" class="logo">
        <span>splashmix.ink</span>
        <span>🐙</span>
      </a>
    </div>
    <div class="header-right">
      <LanguageSwitcher />
      <LoginButton />
    </div>
  </div>

  <!-- Sistema de pestañas -->
  {#if showTabs}
  <div class="tabs-container">
    <button 
      class="tab-btn" 
      class:active={activeTab === 'generate'}
      on:click={() => activeTab = 'generate'}
    >
      Imagen
    </button>
    <button 
      class="tab-btn" 
      class:active={activeTab === 'newTab'}
      on:click={() => activeTab = 'newTab'}
    >
      Face ID
    </button>
  </div>
  {/if}

  {#if activeTab === 'generate'}
  <div class="content">
    <div class="text-area-container">
      <textarea maxlength="1000" bind:this={textareaElement} bind:value={textContent} placeholder={$t('placeholders.prompt')} on:keydown={handleTextareaKeydown}></textarea>
    </div>

    {#if isDev}
      <div class="seed-container">
        <div class="seed-input">
          <label for="seed" class="seed-label">Seed (opcional)</label>
          <input
            id="seed"
            type="number"
            min="0"
            step="1"
            placeholder="Random"
            bind:value={seedInput}
            on:input={() => {
              const parsed = parseSeed(seedInput)
              if (parsed !== null) {
                randomizeSeed = false
              } else if (seedInput === '' || seedInput === null) {
                randomizeSeed = true
              }
            }}
          />
        </div>
        <label class="seed-toggle">
          <input
            type="checkbox"
            bind:checked={randomizeSeed}
            on:change={() => {
              if (randomizeSeed) {
                seedInput = ''
              }
            }}
          />
          <span>Randomizar seed</span>
        </label>
        {#if lastSeed !== null}
          <div class="seed-last">Última seed: {lastSeed}</div>
        {/if}
      </div>
    {/if}
    
    <div class="button-container">
      <button class="create-button" disabled={isLoading} on:click={generateImage}>
        {isLoading ? '⏳ ' + $t('buttons.generating') : $t('buttons.create')}
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
        {$t('login.prompt')}
      </div>
      <LoginButton />
    </div>
  {/if}
  
  {#if showRating && generatedImage}
    <div class="rating-box">
      <p class="rating-title">{$t('rating.title')}</p>
      <div class="stars-container">
        {#each [1, 2, 3, 4, 5] as star}
          <button
            class="star"
            class:filled={star <= (hoveredRating || userRating)}
            on:mouseenter={() => { hoveredRating = star }}
            on:mouseleave={() => { hoveredRating = 0 }}
            on:click={() => { 
              userRating = star
              const calificacionNumerica = star * 20 // Convertir a escala 0-100
              console.log('⭐ Calificación:', userRating, '| Escala 0-100:', calificacionNumerica)
              showRating = false // Cerrar banner inmediatamente
              // Enviar la calificación sin esperar
              guardarCalificacion($user, lastId, calificacionNumerica)
            }}
            title={`${star} estrellas`}
            aria-label={`${star} estrellas`}
          >
            ★
          </button>
        {/each}
      </div>
    </div>
  {/if}
  
  {#if showAdvice && generatedImage}
    <div class="advice-box">
      <p class="advice-text">💡 {currentAdvice}</p>
    </div>
  {/if}

  {#if showActionCallModal}
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-header-row">
          <div class="modal-header-left">
            <input type="radio" checked disabled class="modal-radio" />
            <span class="modal-title-small">Acceso Ilimitado por Siempre</span>
          </div>
          <div class="modal-header-right">
            {#if modalPrice}
              <span class="modal-price-inline">{modalPrice.amount} {modalPrice.currency}</span>
            {/if}
            <button class="modal-buy-btn" on:click={irAComprar} disabled={loadingPayment}>
              {#if loadingPayment}
                <span class="spinner"></span>
              {:else}
                Comprar
              {/if}
            </button>
          </div>
        </div>
        <p class="stripe-security">Pago Seguro con Stripe ®</p>
        <button class="close-btn" on:click={() => {
          showActionCallModal = false
          // Ejecutar en background sin esperar
          marcarCancelBuy($user.uid)
        }}>✕</button>
      </div>
    </div>
  {/if}

  {#if showWelcomeModal}
    <div class="modal-overlay">
      <div class="modal-box welcome-modal">
        <p class="welcome-title">{$t('welcome.title')}</p>
        <p class="welcome-text">{$t('welcome.description')}</p>
        <p class="welcome-subtitle">{$t('welcome.subtitle')}</p>
        <p class="welcome-text-final">{$t('welcome.finalText')}</p>
        {#if $user}
          <button class="welcome-btn" on:click={() => {
            showWelcomeModal = false
            sessionStorage.setItem('welcomeShown', 'true')
          }}>{$t('welcome.startButton')}</button>
        {:else}
          <button class="welcome-btn" on:click={handleGoogleLoginFromWelcome}>{$t('welcome.googleButton')}</button>
        {/if}
      </div>
    </div>
  {/if}
  
  <div class="image-container">
    <div class="image-display">
      {#if generatedImage}
        <div class="image-wrapper">
          <img src={generatedImage} alt="Imagen generada" on:dblclick={() => showFullImage = true} />
          <div class="image-actions">
            <button class="action-btn" on:click={() => showFullImage = true} title="Ver en grande" aria-label="Ver imagen en grande">
              ⤢
            </button>
            <button class="action-btn" on:click={downloadImage} title="Descargar imagen" aria-label="Descargar imagen">
              ⬇️
            </button>
          </div>
        </div>
      {:else}
        <p>{$t('messages.imageAppears')}</p>
      {/if}
    </div>
  </div>
  </div>
  {/if}
  
  {#if activeTab === 'newTab'}
  <div class="content new-tab-content">
    <div class="text-area-container">
      <textarea maxlength="1000" bind:this={textareaElement} bind:value={textContent} placeholder={$t('placeholders.prompt')} on:keydown={handleTextareaKeydown}></textarea>
    </div>
    
    <div class="three-column-layout">
      <div class="upload-column">
        <h3 class="column-title">{$t('faceid.faceImageColumn')}</h3>
        <div class="upload-area">
          <label for="image-upload" class="upload-label">
            <div class="upload-box">
              {#if uploadedImage}
                <img src={uploadedImage} alt="Imagen facial" class="uploaded-preview" />
              {:else}
                <div class="upload-placeholder">
                  <span class="upload-icon">📁</span>
                  <p class="upload-text">{$t('faceid.clickToUpload')}</p>
                  <p class="upload-hint">{$t('faceid.facePhotoHint')}</p>
                </div>
              {/if}
            </div>
          </label>
          <input 
            id="image-upload" 
            type="file" 
            accept="image/*" 
            on:change={handleImageUpload}
            style="display: none;"
          />
        </div>
      </div>

      <div class="upload-column">
        <h3 class="column-title">{$t('faceid.poseImageColumn')}</h3>
        <div class="upload-area">
          <label for="pose-upload" class="upload-label">
            <div class="upload-box">
              {#if uploadedPoseImage}
                <img src={uploadedPoseImage} alt="Imagen de pose" class="uploaded-preview" />
              {:else}
                <div class="upload-placeholder">
                  <span class="upload-icon">📁</span>
                  <p class="upload-text">{$t('faceid.clickToUpload')}</p>
                  <p class="upload-hint">{$t('faceid.poseImageHint')}</p>
                </div>
              {/if}
            </div>
          </label>
          <input 
            id="pose-upload" 
            type="file" 
            accept="image/*" 
            on:change={handlePoseImageUpload}
            style="display: none;"
          />
        </div>
      </div>
      
      <div class="preview-column">
        <h3 class="column-title">{$t('faceid.resultColumn')}</h3>
        <div class="image-container">
          <div class="image-display">
            {#if faceIDGeneratedImage}
              <div class="image-wrapper">
                <img src={faceIDGeneratedImage} alt="Imagen Face ID generada" on:dblclick={() => showFullFaceIDImage = true} />
                <div class="image-actions">
                  <button class="action-btn" on:click={() => showFullFaceIDImage = true} title={$t('buttons.viewFullSize')} aria-label={$t('buttons.viewFullSize')}>
                    ⤢
                  </button>
                  <button class="action-btn" on:click={downloadFaceIDImage} title={$t('buttons.download')} aria-label={$t('buttons.download')}>
                    ⬇️
                  </button>
                </div>
              </div>
            {:else}
              <p>{$t('messages.imageAppears')}</p>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="button-container">
      <button class="create-button" on:click={handleFaceIDGeneration} disabled={isLoading}>
        {isLoading ? '⏳ ' + $t('buttons.generating') : '🎨 ' + $t('buttons.create')}
      </button>
    </div>

    {#if isLoading}
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
    {/if}
  </div>
  {/if}
  
  {#if showFullImage && generatedImage}
    <div class="fullscreen-backdrop" on:click={() => showFullImage = false}></div>
    <div class="fullscreen-modal">
      <img src={generatedImage} alt="Imagen generada ampliada" on:dblclick={() => showFullImage = false} />
      <button class="close-fullscreen" on:click={() => showFullImage = false} title={$t('buttons.close')} aria-label={$t('buttons.close')}>
        ✕
      </button>
    </div>
  {/if}
  
  {#if showFullFaceIDImage && faceIDGeneratedImage}
    <div class="fullscreen-backdrop" on:click={() => showFullFaceIDImage = false}></div>
    <div class="fullscreen-modal">
      <img src={faceIDGeneratedImage} alt="Imagen Face ID ampliada" on:dblclick={() => showFullFaceIDImage = false} />
      <button class="close-fullscreen" on:click={() => showFullFaceIDImage = false} title={$t('buttons.close')} aria-label={$t('buttons.close')}>
        ✕
      </button>
    </div>
  {/if}
</main>
