import '@fortawesome/fontawesome-free/css/all.min.css'
import App from './App.svelte'
import './lib/i18n' // Inicializar i18n

const app = new App({
  target: document.getElementById('app')
})

export default app
