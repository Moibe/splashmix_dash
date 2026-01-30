// Mapeo de países a idiomas
export const countryToLanguage = {
  // Español
  'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'PE': 'es', 'VE': 'es', 'CL': 'es', 'EC': 'es', 'BO': 'es', 'PY': 'es', 'UY': 'es', 'CU': 'es', 'DO': 'es', 'CR': 'es', 'PA': 'es', 'HN': 'es', 'SV': 'es', 'NI': 'es', 'GT': 'es', 'BZ': 'es', 'GQ': 'es',
  // Inglés
  'US': 'en', 'GB': 'en', 'CA': 'en', 'AU': 'en', 'NZ': 'en', 'IE': 'en', 'IN': 'en', 'ZA': 'en', 'SG': 'en', 'PH': 'en', 'JM': 'en', 'BZ': 'en'
}

export function getLanguageByCountry(country) {
  if (!country) return 'en'
  const upper = country.toUpperCase()
  return countryToLanguage[upper] || 'en'
}
