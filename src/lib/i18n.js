import { addMessages, init, getLocaleFromNavigator } from 'svelte-i18n'
import es from '../locales/es.json'
import en from '../locales/en.json'

// Registrar los mensajes
addMessages('es', es)
addMessages('en', en)

// Obtener idioma guardado o usar español por defecto
function getInitialLocale() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('locale')
    if (saved && (saved === 'es' || saved === 'en')) {
      return saved
    }
  }
  return 'es'
}

// Inicializar svelte-i18n
init({
  fallbackLocale: 'es',
  initialLocale: getInitialLocale(),
  messages: {
    es,
    en
  }
})
