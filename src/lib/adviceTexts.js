// Consejos para mejorar la generación de imágenes
// Los textos reales vienen del i18n, esto es solo un placeholder
import { get } from 'svelte/store'
import { t } from 'svelte-i18n'

export function getRandomAdvice() {
  const advice = get(t)
  const tips = [
    advice('advice.tip1'),
    advice('advice.tip2'),
    advice('advice.tip3'),
    advice('advice.tip4'),
    advice('advice.tip5'),
    advice('advice.tip6'),
    advice('advice.tip7')
  ]
  const randomIndex = Math.floor(Math.random() * tips.length)
  return tips[randomIndex]
}

