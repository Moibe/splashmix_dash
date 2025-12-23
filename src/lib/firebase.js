import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'

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

// Función para guardar el contador en Firestore
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

// Función para obtener el contador guardado
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
