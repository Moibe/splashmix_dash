import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, increment } from 'firebase/firestore'
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

// Función para registrar nuevo usuario en Firestore
export async function registrarNuevoUsuario(user) {
  try {
    // Usar UID como ID del documento (simple, único y sin duplicados)
    const userDocRef = doc(db, 'usuarios_ig', user.uid)
    const docSnap = await getDoc(userDocRef)
    
    // Si NO existe = crear
    if (!docSnap.exists()) {
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
        uid: user.uid,
        displayName: user.displayName || 'Usuario',
        email: user.email,
        fecha_registro: new Date().toISOString(),
        usos: 0,  // Inicializar contador de imágenes generadas
        country_ip: country_ip || null,
        country_header: country_header || null,
        gaClient: gaClient
      })
      console.log('✅ Nuevo usuario registrado:', user.uid, '| País:', country_ip, '| GA:', gaClient)
      return true
    } else {
      console.log('ℹ️  Usuario existente:', user.uid)
      return false
    }
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
    const userDocRef = doc(db, 'usuarios_ig', user.uid)
    await setDoc(userDocRef, { usos: increment(1) }, { merge: true })
    console.log('✅ Contador de usos incrementado')
    return true
  } catch (error) {
    console.error('❌ Error incrementando usos:', error)
    return false
  }
}
