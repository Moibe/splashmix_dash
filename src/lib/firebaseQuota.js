// Configuración de Firebase para flux-ia-182 (lectura de cuotas)
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfigQuota = {
  apiKey: 'AIzaSyAIum9RGErAm3pFu5ljQTp_JOD0nAsHtMg',
  authDomain: 'flux-ia-182.firebaseapp.com',
  projectId: 'flux-ia-182',
  storageBucket: 'flux-ia-182.firebasestorage.app',
  messagingSenderId: '951430334152',
  appId: '1:951430334152:web:8794b7208a8ff77db2c7fd'
}

const appQuota = initializeApp(firebaseConfigQuota, 'quota-app')
export const dbQuota = getFirestore(appQuota)
