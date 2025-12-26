import { writable } from 'svelte/store'
import { auth } from './firebase'
import { registrarNuevoUsuario } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'

export const user = writable(null)
export const loading = writable(true)

// Escucha cambios en la autenticación
onAuthStateChanged(auth, (currentUser) => {
  if (currentUser) {
    // Registrar si es nuevo usuario
    registrarNuevoUsuario(currentUser)
  }
  user.set(currentUser)
  loading.set(false)
})
