import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, increment, query, where, getDocs, deleteField } from 'firebase/firestore'
import { dbQuota } from './firebaseQuota'
import { tokens, proveedores, process_cost, process_margin, api_cost } from './bridges'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Función para obtener la cuota disponible de un proveedor (desde flux-ia-182)
async function getQuotaForProvider(proveedor) {
  try {
    const quotaDocRef = doc(dbQuota, 'power', proveedor)
    const docSnap = await getDoc(quotaDocRef)
    if (docSnap.exists()) {
      return docSnap.data().segundos || 0
    }
    return 0
  } catch (error) {
    console.error(`Error al obtener cuota de ${proveedor}:`, error)
    return 0
  }
}

// Función para actualizar la cuota de un proveedor (en flux-ia-182)
async function updateQuotaForProvider(proveedor, segundosRestantes) {
  try {
    const quotaDocRef = doc(dbQuota, 'power', proveedor)
    await setDoc(quotaDocRef, { segundos: segundosRestantes }, { merge: true })
  } catch (error) {
    console.error(`Error al actualizar cuota de ${proveedor}:`, error)
  }
}

// Función revisor de cuotas (similar a Python)
export async function revisorCuotas() {
  console.log('🔍 Revisando cuotas de proveedores...')
  
  const totalElementos = proveedores.length
  
  for (let indice = 0; indice < proveedores.length; indice++) {
    const proveedor = proveedores[indice]
    console.log(`📊 Revisando: ${proveedor}`)
    
    const quotaDisponible = await getQuotaForProvider(proveedor)
    console.log(`   Servidor ${proveedor}: ${quotaDisponible} segundos disponibles`)
    
    if (quotaDisponible > process_cost) {
      console.log(`✅ Servidor seleccionado: ${proveedor} (${quotaDisponible} segundos)`)
      
      // Si es el último elemento, revisar si necesita encendido preventivo
      if (indice === totalElementos - 1) {
        console.log('⚠️  Último elemento - verificando encendido preventivo')
        const quotasRestantes = quotaDisponible - process_cost
        console.log(`   Cuota después del proceso: ${quotasRestantes}`)
        
        if (quotasRestantes < process_margin) {
          console.log('🔥 Activando encendido preventivo (crédito costo)')
          // Aquí iría la lógica para activar un nuevo crédito
          // Por ahora solo lo registramos
        }
      }
      
      // NO actualizar cuota aquí - se hará DESPUÉS de que se genere la imagen exitosamente
      return {
        proveedor: proveedor,
        token: tokens[proveedor],
        quotaDisponible: quotaDisponible,
        quotaUsada: process_cost
      }
    }
  }
  
  // Si llegó aquí, ninguno tiene cuota suficiente
  console.log('❌ Ningún proveedor tiene cuota suficiente - usando crédito COSTO')
  return {
    proveedor: 'costo',
    token: tokens.costo,
    quotaDisponible: 0,
    quotaUsada: api_cost
  }
}

// Exportar función para actualizar cuota (se llamará después de generar imagen)
export async function actualizarCuotaDespuesDeGenerar(proveedor, quotaDisponible) {
  if (proveedor === 'costo') {
    console.log('⏭️  No se actualiza cuota para proveedor "costo"')
    return
  }
  
  const nuevaCuota = quotaDisponible - process_cost
  console.log(`💾 Actualizando cuota de ${proveedor}: ${quotaDisponible} → ${nuevaCuota}`)
  await updateQuotaForProvider(proveedor, nuevaCuota)
}

export async function marcarProveedorSinCuota(proveedor) {
  if (!proveedor || proveedor === 'costo') {
    return
  }
  console.log(`🚫 Marcando proveedor sin cuota: ${proveedor}`)
  await updateQuotaForProvider(proveedor, 0)
}

// Función para detectar país por IP
async function detectCountryByIP() {
  try {
    const response = await fetch('https://ipapi.co/json/')
    const data = await response.json()
    return data.country_code || null
  } catch (error) {
    console.error('❌ Error detectando país por IP:', error)
    return null
  }
}

// Función para actualizar ritmo en documento del usuario
export async function actualizarRitmo(user) {
  try {
    if (!user || !user.uid) {
      console.warn('⚠️ Usuario no disponible para actualizar ritmo')
      return false
    }

    const userDocRef = await getUserDocRefByUid(user.uid)
    
    if (!userDocRef) {
      console.warn('⚠️ No se encontró documento de usuario para:', user.uid)
      return false
    }
    
    const userDocSnap = await getDoc(userDocRef)
    
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data()
      const usos = userData.usos || 0
      const fechaRegistro = userData.fecha_registro
      const ritmo = calcularRitmo(usos, fechaRegistro)
      
      await setDoc(userDocRef, { ritmo: ritmo }, { merge: true })
      console.log(`📊 Ritmo actualizado en Firestore: ${ritmo}`)
      return true
    } else {
      console.warn('⚠️ Documento de usuario no existe')
      return false
    }
  } catch (error) {
    console.error('❌ Error actualizando ritmo:', error)
    return false
  }
}

export async function actualizarUltimoUso(user) {
  try {
    if (!user || !user.uid) {
      console.warn('⚠️ Usuario no disponible para actualizar último uso')
      return false
    }

    const userDocRef = await getUserDocRefByUid(user.uid)
    
    if (!userDocRef) {
      console.warn('⚠️ No se encontró documento de usuario para:', user.uid)
      return false
    }
    
    const ahora = new Date().toISOString()
    await setDoc(userDocRef, { ultimo_uso: ahora }, { merge: true })
    console.log(`⏰ Último uso actualizado en Firestore: ${ahora}`)
    return true
  } catch (error) {
    console.error('❌ Error actualizando último uso:', error)
    return false
  }
}

export function calcularRitmo(usos, fechaRegistro) {
  try {
    if (!usos || usos === 0) {
      console.warn('⚠️ Usos no disponibles para calcular ritmo')
      return 0
    }
    
    if (!fechaRegistro) {
      console.warn('⚠️ fecha_registro no disponible para calcular ritmo')
      return 0
    }
    
    const fecha = new Date(fechaRegistro)
    if (isNaN(fecha.getTime())) {
      console.warn('⚠️ fecha_registro inválida:', fechaRegistro)
      return 0
    }
    
    const ahora = new Date()
    const diferenciaMs = ahora - fecha
    const diasTranscurridos = diferenciaMs / (1000 * 60 * 60 * 24)
    const diasRedondeados = Math.round(diasTranscurridos)
    const ritmo = usos / diasTranscurridos
    
    // Logs desglosados paso a paso
    console.log('📅 Fecha de registro:', fecha.toISOString())
    console.log('📅 Fecha actual:', ahora.toISOString())
    console.log('📅 Diferencia en ms:', diferenciaMs)
    console.log(`📅 Días transcurridos: ${diasRedondeados} ${diasRedondeados === 1 ? 'día' : 'días'}`)
    console.log(`📊 Cálculo: ${usos} ÷ ${diasTranscurridos.toFixed(4)} = ${ritmo.toFixed(4)}`)
    
    // Evitar división por cero si es el primer día
    if (diasTranscurridos < 1) return parseFloat(usos)
    
    return parseFloat(ritmo.toFixed(2))
  } catch (error) {
    console.error('❌ Error calculando ritmo:', error)
    return 0
  }
}

// Función helper para obtener documento de usuario por su uid (ahora es un campo, no el ID del doc)
export async function getUserDocRefByUid(userUid) {
  try {
    // Primero intenta buscar por campo uid (usuarios nuevos)
    const q = query(collection(db, 'usuarios_ig'), where('uid', '==', userUid))
    const querySnapshot = await getDocs(q)
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].ref
    }
    
    // Si no encuentra, intenta buscar por ID del documento (usuarios viejos)
    const oldDocRef = doc(db, 'usuarios_ig', userUid)
    const oldDocSnap = await getDoc(oldDocRef)
    if (oldDocSnap.exists()) {
      return oldDocRef
    }
    
    return null
  } catch (error) {
    console.error('❌ Error buscando documento de usuario por uid:', error)
    return null
  }
}

// Función para limpiar campos de debug
export async function limpiarCamposDebug(userUid) {
  try {
    console.log('🧹 Limpiando campos de debug del usuario:', userUid)
    const userDocRef = await getUserDocRefByUid(userUid)
    if (!userDocRef) {
      console.warn('⚠️ No se encontró documento de usuario:', userUid)
      return false
    }
    
    await setDoc(userDocRef, {
      racha: deleteField(),
      _debug_force_update: deleteField()
    }, { merge: true })
    console.log('✅ Campos de debug eliminados')
    return true
  } catch (error) {
    console.error('❌ Error limpiando campos de debug:', error)
    return false
  }
}

// Función para asegurar que usuarios existentes tengan los campos open_use, creditos y streak
export async function asegurarCamposUsuario(userUid) {
  try {
    console.log('🔍 Buscando usuario con uid:', userUid)
    const userDocRef = await getUserDocRefByUid(userUid)
    if (!userDocRef) {
      console.warn('⚠️ No se encontró documento de usuario:', userUid)
      return false
    }
    
    console.log('📍 Documento encontrado en path:', userDocRef.path)
    const docSnap = await getDoc(userDocRef)
    if (!docSnap.exists()) {
      console.warn('⚠️ El documento no existe:', userUid)
      return false
    }
    
    const userData = docSnap.data()
    console.log('📋 Datos actuales del usuario:', Object.keys(userData))
    const fieldsToAdd = {}
    
    // Verificar y agregar campos faltantes
    if (!userData.hasOwnProperty('open_use')) {
      fieldsToAdd.open_use = true
    }
    if (!userData.hasOwnProperty('creditos')) {
      fieldsToAdd.creditos = 0
    }
    if (!userData.hasOwnProperty('streak')) {
      fieldsToAdd.streak = 1
    }
    if (!userData.hasOwnProperty('action_call')) {
      fieldsToAdd.action_call = false
    }
    if (!userData.hasOwnProperty('esta_hora')) {
      fieldsToAdd.esta_hora = 0
    }
    if (!userData.hasOwnProperty('ultima_generacion_hora')) {
      fieldsToAdd.ultima_generacion_hora = null
    }
    
    // Si hay campos que agregar, hacerlo
    if (Object.keys(fieldsToAdd).length > 0) {
      console.log('🔄 Agregando campos faltantes:', fieldsToAdd)
      await setDoc(userDocRef, fieldsToAdd, { merge: true })
      console.log('✅ Campos agregados exitosamente')
      return true
    } else {
      console.log('ℹ️ Todos los campos ya existen')
    }
    
    return false
  } catch (error) {
    console.error('❌ Error asegurando campos de usuario:', error)
    return false
  }
}

// Función para registrar nuevo usuario en Firestore
export async function registrarNuevoUsuario(user) {
  try {
    // Primero buscar si ya existe un documento con este uid
    const existingDocRef = await getUserDocRefByUid(user.uid)
    
    if (existingDocRef) {
      console.log('ℹ️  Usuario existente:', user.uid)
      return false
    }
    
    // Si no existe, crear uno nuevo con ID timestamp-email
    const invertedTimestamp = 9999999999 - Math.floor(Date.now() / 1000)
    const docId = `${invertedTimestamp}-${user.email}`
    const userDocRef = doc(db, 'usuarios_ig', docId)
    
    // Detectar país por IP
    const country_ip = await detectCountryByIP()
    if (country_ip) {
      localStorage.setItem('country_ip', country_ip)
    }
    
    // Detectar país por header (misma API, diferente key)
    const country_header = country_ip // Mismo valor, diferente storage key
    if (country_header) {
      localStorage.setItem('country_header', country_header)
    }

    // Captar GA Client ID (inyectado por Tag Manager)
    const gaClient = window.gaGlobal?.vid || null
    if (gaClient) {
      console.log('📊 GA Client detectado:', gaClient)
    } else {
      console.warn('⚠️ GA Client NO detectado')
    }

    await setDoc(userDocRef, {
      uid: user.uid,  // Guardar uid como campo para búsquedas futuras
      displayName: user.displayName || 'Usuario',
      email: user.email,
      fecha_registro: new Date().toISOString(),
      usos: 0,  // Inicializar contador de imágenes generadas
      country_ip: country_ip || null,
      country_header: country_header || null,
      gaClient: gaClient,
      explicit_counter: 0,  // Inicializar contador de contenido explícito
      open_use: true,  // Acceso abierto
      creditos: 0,  // Créditos iniciales
      streak: 1,  // Racha inicial
      action_call: false,  // Flag de acción
      esta_hora: 0,  // Contador de acciones esta hora
      ultima_generacion_hora: null  // Timestamp de la última generación
    })
    console.log('✅ Nuevo usuario registrado:', user.uid, '| País:', country_ip, '| GA:', gaClient)
    return true
  } catch (error) {
    console.error('❌ Error registrando usuario:', error)
    return false
  }
}
export async function saveCounterToFirestore(userId, counterValue) {
  try {
    const userDocRef = doc(db, 'usuarios_ig', userId)
    await setDoc(userDocRef, {
      counterValue: counterValue,
      lastSaved: new Date().toISOString()
    }, { merge: true })
    return { success: true, message: 'Contador guardado correctamente' }
  } catch (error) {
    console.error('Error al guardar el contador:', error)
    return { success: false, message: error.message }
  }
}

export async function getCounterFromFirestore(userId) {
  try {
    const userDocRef = doc(db, 'usuarios_ig', userId)
    const docSnap = await getDoc(userDocRef)
    if (docSnap.exists()) {
      return docSnap.data().counterValue || 0
    }
    return 0
  } catch (error) {
    console.error('Error al obtener el contador:', error)
    return 0
  }
}

// Función para contar generaciones en la última hora sin usar log_ig
export async function actualizarEstahora(userUid) {
  try {
    const userDocRef = await getUserDocRefByUid(userUid)
    
    if (!userDocRef) {
      console.warn('⚠️ No se encontró documento de usuario:', userUid)
      return false
    }
    
    const docSnap = await getDoc(userDocRef)
    if (!docSnap.exists()) {
      console.warn('⚠️ El documento no existe:', userUid)
      return false
    }
    
    const userData = docSnap.data()
    const ahora = new Date()
    const ultimaGeneracionHora = userData.ultima_generacion_hora ? new Date(userData.ultima_generacion_hora) : null
    let estahora = userData.esta_hora || 0
    
    // Si la última generación fue hace más de 1 hora, resetear contador
    if (ultimaGeneracionHora) {
      const diferencia = ahora.getTime() - ultimaGeneracionHora.getTime()
      const unaHoraMs = 60 * 60 * 1000
      
      if (diferencia > unaHoraMs) {
        // Más de 1 hora, resetear a 1
        estahora = 1
      } else {
        // Menos de 1 hora, incrementar
        estahora += 1
      }
    } else {
      // Primera generación, establecer a 1
      estahora = 1
    }
    
    // Actualizar documento con new count y timestamp
    await setDoc(userDocRef, { 
      esta_hora: estahora,
      ultima_generacion_hora: ahora.toISOString()
    }, { merge: true })
    
    console.log(`⏰ Campo esta_hora actualizado a: ${estahora}`)
    return true
  } catch (error) {
    console.error('❌ Error actualizando esta_hora:', error)
    return false
  }
}

// Función para guardar log de generación de imagen
export async function guardarLogGeneracion(user, prompt, seed, proveedor) {
  try {
    const logRef = collection(db, 'log_ig')
    // Timestamp invertido para que los más recientes aparezcan primero
    const invertedTimestamp = (9999999999999 - Date.now()).toString()
    const docId = `${invertedTimestamp}_${user.uid.slice(0, 8)}`
    
    await setDoc(doc(db, 'log_ig', docId), {
      uid: user.uid,
      displayName: user.displayName || 'Usuario',
      email: user.email,
      prompt: prompt,
      seed: seed,
      proveedor: proveedor,
      fecha_creacion: new Date().toISOString()
    })
    console.log('📝 Log generación guardado')
    return true
  } catch (error) {
    console.error('❌ Error guardando log:', error)
    return false
  }
}

// Función para guardar log de errores
export async function guardarLogError(user, prompt, errorMessage, proveedorIntentado) {
  try {
    const logErrorRef = collection(db, 'log_errores_ig')
    await addDoc(logErrorRef, {
      uid: user.uid,
      displayName: user.displayName || 'Usuario',
      email: user.email,
      prompt: prompt,
      error_message: errorMessage,
      proveedor_intentado: proveedorIntentado,
      fecha_error: new Date().toISOString()
    })
    console.log('⚠️  Log de error guardado')
    return true
  } catch (error) {
    console.error('❌ Error guardando log de error:', error)
    return false
  }
}

// Función para incrementar el contador de usos (imágenes generadas)
export async function incrementarUsos(user) {
  try {
    if (!user || !user.uid) {
      console.warn('⚠️ Usuario no disponible para incrementar usos')
      return false
    }

    const userDocRef = await getUserDocRefByUid(user.uid)
    
    if (!userDocRef) {
      console.warn('⚠️ No se encontró documento de usuario para:', user.uid)
      return false
    }

    await setDoc(userDocRef, { usos: increment(1) }, { merge: true })
    console.log('✅ Contador de usos incrementado')
    return true
  } catch (error) {
    console.error('❌ Error incrementando usos:', error)
    return false
  }
}

// Función para registrar generación en MariaDB via FastAPI
export async function registrarGeneracionEnAPI(user, prompt, seed, proveedor, classification, estilos = [], estadoCaravaggio = 'sin estilo agregado') {
  try {
    const apiUrl = import.meta.env.VITE_API_URL
    console.log('🎨 registrarGeneracionEnAPI recibió estilos:', estilos)
    console.log('🎨 registrarGeneracionEnAPI recibió estadoCaravaggio:', estadoCaravaggio)
    if (!apiUrl) {
      console.warn('⚠️ VITE_API_URL no configurado')
      return false
    }

    // Obtener país y usos: primero desde localStorage/Firestore
    let pais = localStorage.getItem('country_ip')
    let usos = 1
    let ritmo = 0
    let fechaRegistro = null
    
    if (!pais) {
      try {
        const userDocRef = await getUserDocRefByUid(user.uid)
        if (userDocRef) {
          const userDocSnap = await getDoc(userDocRef)
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data()
            console.log('👤 Datos del usuario:', userData)
            // Intentar primero country_header, luego country_ip
            pais = userData.country_header || userData.country_ip || 'Desconocido'
            // Obtener usos tal cual está en Firestore
            usos = userData.usos || 1
            // Obtener fecha_registro para calcular ritmo
            fechaRegistro = userData.fecha_registro
            ritmo = calcularRitmo(usos, fechaRegistro)
            console.log(`📊 Ritmo calculado: ${ritmo}`)
          } else {
            pais = 'Desconocido'
          }
        } else {
          pais = 'Desconocido'
        }
      } catch (error) {
        console.warn('⚠️ No se pudo obtener país y usos de Firestore:', error)
        pais = 'Desconocido'
      }
    } else {
      // Si el país está en localStorage, igual obtener usos de Firestore
      try {
        const userDocRef = await getUserDocRefByUid(user.uid)
        if (userDocRef) {
          const userDocSnap = await getDoc(userDocRef)
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data()
            console.log('👤 Datos del usuario:', userData)
            usos = userData.usos || 1
            fechaRegistro = userData.fecha_registro
            ritmo = calcularRitmo(usos, fechaRegistro)
            console.log(`📊 Ritmo calculado: ${ritmo}`)
          }
        }
      } catch (error) {
        console.warn('⚠️ No se pudo obtener usos de Firestore:', error)
      }
    }

    // Construir prompt_type y prompt_eval basado en clasificación
    let prompt_type = 'clasificador inactivo'
    let prompt_eval = null
    if (classification && classification.ok && classification.labels && classification.labels.length > 0) {
      // Orden predefinido para consistencia en búsquedas
      const labelOrder = ['explicit', 'specific_character', 'text_heavy', 'normal']
      let sortedLabels = classification.labels.sort((a, b) => 
        labelOrder.indexOf(a) - labelOrder.indexOf(b)
      )
      
      // Si hay múltiples labels y uno es "normal", removerlo (no es necesario acompañado de otros)
      if (sortedLabels.length > 1) {
        sortedLabels = sortedLabels.filter(label => label !== 'normal')
      }
      
      prompt_type = sortedLabels.join(', ')
      prompt_eval = (classification.reasons && classification.reasons.length > 0) ? classification.reasons[0] : null
    }

    const payload = {
      uid: user.uid,
      display_name: user.displayName || 'Usuario',
      correo: user.email,
      pais: pais,
      prompt: prompt,
      seed: seed,
      proveedor: proveedor,
      usos: usos,
      ritmo: ritmo,
      prompt_type: prompt_type,
      prompt_eval: prompt_eval,
      estilo: (Array.isArray(estilos) && estilos.length > 0) ? estilos.join(', ') : null,
      estilo_agregado: estadoCaravaggio
    }

    console.log('📤 Payload a enviar:', payload)

    const response = await fetch(`${apiUrl}/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      console.warn(`⚠️ Error registrando en API: ${response.status}`)
      return { ok: false, id: null }
    }

    const data = await response.json()
    console.log('✅ Generación registrada en MariaDB')
    console.log('📝 Respuesta completa:', data)
    const registroId = data.data?.id
    console.log('📝 ID extraído:', registroId)
    return { ok: true, id: registroId }
  } catch (error) {
    console.error('❌ Error registrando en API:', error)
    return { ok: false, id: null }
  }
}

// Función para incrementar contador de prompts explícitos
export async function incrementarExplicitCounter(user) {
  try {
    if (!user || !user.uid) {
      console.warn('⚠️ Usuario no disponible para incrementar explicit_counter')
      return false
    }

    const userDocRef = await getUserDocRefByUid(user.uid)
    
    if (!userDocRef) {
      console.warn('⚠️ No se encontró documento de usuario para:', user.uid)
      return false
    }
    
    // Obtener el documento actual
    const userDocSnap = await getDoc(userDocRef)
    
    if (userDocSnap.exists()) {
      // Si existe, incrementar el contador
      const currentCount = userDocSnap.data().explicit_counter || 0
      await setDoc(userDocRef, { explicit_counter: currentCount + 1 }, { merge: true })
    } else {
      // Si no existe el documento, crearlo con explicit_counter = 1
      await setDoc(userDocRef, { explicit_counter: 1 }, { merge: true })
    }

    console.log('📊 Contador explícito incrementado')
    return true
  } catch (error) {
    console.error('❌ Error incrementando explicit_counter:', error)
    return false
  }
}
export async function registrarErrorEnAPI(user, prompt, errorMessage, proveedor) {
  try {
    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) {
      console.warn('⚠️ VITE_API_URL no configurado')
      return false
    }

    // Obtener país: primero desde localStorage, si no está, desde Firestore
    let pais = localStorage.getItem('country_ip')
    if (!pais) {
      try {
        const userDocRef = await getUserDocRefByUid(user.uid)
        if (userDocRef) {
          const userDocSnap = await getDoc(userDocRef)
          if (userDocSnap.exists()) {
            pais = userDocSnap.data().country_header || userDocSnap.data().country_ip || 'Desconocido'
          } else {
            pais = 'Desconocido'
          }
        } else {
          pais = 'Desconocido'
        }
      } catch (error) {
        console.warn('⚠️ No se pudo obtener país de Firestore:', error)
        pais = 'Desconocido'
      }
    }

    const payload = {
      uid: user.uid,
      display_name: user.displayName || 'Usuario',
      correo: user.email,
      pais: pais,
      prompt: `error: ${errorMessage}`,
      proveedor: proveedor
    }

    const response = await fetch(`${apiUrl}/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      console.warn(`⚠️ Error registrando error en API: ${response.status}`)
      return false
    }

    console.log('✅ Error registrado en MariaDB')
    return true
  } catch (error) {
    console.error('❌ Error registrando error en API:', error)
    return false
  }
}

// Función para guardar calificación de imagen en MariaDB
export async function guardarCalificacion(user, id, calificacionNumerica) {
  try {
    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) {
      console.warn('⚠️ VITE_API_URL no configurado')
      return false
    }

    if (!id) {
      console.error('❌ Error: ID de registro es null o undefined')
      return false
    }

    const payload = {
      id: id,
      calificacion: calificacionNumerica
    }

    console.log('⭐ Guardando calificación:', payload)

    const response = await fetch(`${apiUrl}/guardar-calificacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn(`⚠️ Error guardando calificación: ${response.status}`)
      console.warn('📝 Respuesta del servidor:', errorText)
      return false
    }

    console.log('✅ Calificación guardada en MariaDB')
    return true
  } catch (error) {
    console.error('❌ Error guardando calificación:', error)
    return false
  }
}

// Función para evaluar si action_call debe ser true
export async function evaluarActionCall(userUid) {
  try {
    console.log('🔍 Evaluando action_call para usuario:', userUid)
    
    // Cargar los parámetros desde el JSON
    const response = await fetch('/call2action.json')
    const thresholds = await response.json()
    console.log('📋 Umbrales cargados:', thresholds)
    
    // Obtener el documento del usuario
    const userDocRef = await getUserDocRefByUid(userUid)
    if (!userDocRef) {
      console.warn('⚠️ No se encontró referencia del usuario')
      return false
    }
    
    const userDocSnap = await getDoc(userDocRef)
    if (!userDocSnap.exists()) {
      console.warn('⚠️ No se encontró documento del usuario')
      return false
    }
    
    const userData = userDocSnap.data()
    console.log('👤 Datos del usuario:', {
      ritmo: userData.ritmo || 0,
      streak: userData.streak || 0,
      explicit_counter: userData.explicit_counter || 0,
      esta_hora: userData.esta_hora || 0
    })
    
    // Evaluar cada campo
    const evaluaciones = {
      ritmo: (userData.ritmo || 0) > thresholds.ritmo,
      streak: (userData.streak || 0) > thresholds.streak,
      explicit: (userData.explicit_counter || 0) > thresholds.explicit,
      esta_hora: (userData.esta_hora || 0) > thresholds.esta_hora
    }
    
    console.log('⚖️ Comparación:', {
      ritmo: `${userData.ritmo || 0} > ${thresholds.ritmo} = ${evaluaciones.ritmo}`,
      streak: `${userData.streak || 0} > ${thresholds.streak} = ${evaluaciones.streak}`,
      explicit: `${userData.explicit_counter || 0} > ${thresholds.explicit} = ${evaluaciones.explicit}`,
      esta_hora: `${userData.esta_hora || 0} > ${thresholds.esta_hora} = ${evaluaciones.esta_hora}`
    })
    
    // Si alguno supera, cambiar action_call a true
    const actionCallActive = evaluaciones.ritmo || evaluaciones.streak || evaluaciones.explicit || evaluaciones.esta_hora
    
    if (actionCallActive) {
      console.log('🚨 ACCIÓN REQUERIDA: Al menos un umbral fue superado!')
      console.log('📌 Campos que superaron umbral:', Object.entries(evaluaciones).filter(([_, v]) => v).map(([k]) => k))
      
      // Actualizar action_call a true
      await setDoc(userDocRef, { action_call: true }, { merge: true })
      console.log('✅ action_call establecido a TRUE en Firestore')
      return true
    } else {
      console.log('✅ Todos los campos están dentro de los límites')
      return false
    }
  } catch (error) {
    console.error('❌ Error evaluando action_call:', error)
    return false
  }
}
