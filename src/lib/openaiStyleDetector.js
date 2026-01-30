/**
 * Módulo para detectar estilos artísticos en prompts usando OpenAI Responses API
 * Retorna array de estilos detectados (separados por comas)
 */

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export async function detectarEstilos(prompt) {
  if (!prompt || prompt.trim() === '') {
    console.warn('⚠️ Prompt vacío para detectar estilos')
    return { estilos: [], ok: false }
  }

  const instructions = `Eres un detector de estilos artísticos flexible y abierto.
Analiza el prompt dado y detecta CUALQUIER mención de estilos artísticos, técnicas, movimientos artísticos o referencias estilísticas.

TIPOS DE ESTILOS A DETECTAR:
- Movimientos artísticos: realista, surrealista, abstracto, minimalista, expresionista, cubismo, etc.
- Técnicas: acuarela, óleo, pastel, lápiz, digital, fotografía, etc.
- Géneros visuales: anime, comic, pixel art, cartoon, 3D, ilustración, etc.
- Épocas/Periodos: renacimiento, barroco, moderno, contemporáneo, victoriano, etc.
- Influencias de artistas: estilo Van Gogh, estilo Picasso, estilo Miyazaki, estilo Studio Ghibli, etc.
- Subcultures/Estilos: cyberpunk, steampunk, gothic, retro, vintage, neon, graffiti, etc.
- Cualquier otra referencia estilística que el usuario mencione

INSTRUCCIONES:
1. Lee el prompt cuidadosamente
2. Detecta CUALQUIER mención de estilos, técnicas, géneros, épocas o referencias estilísticas
3. NO te limites a una lista predefinida - sé flexible y abierto
4. Si hay múltiples estilos, sepáralos por comas
5. Si no detectas estilos, responde: sin_estilo
6. Devuelve SOLO el resultado en JSON: {"estilos": ["estilo1", "estilo2"] o "sin_estilo"}
7. Normaliza los nombres (ej: "estilo Van Gogh" → "Van Gogh", "tipo anime" → "anime")

EJEMPLOS:
- "pintura realista con toques expresionistas" → {"estilos": ["realista", "expresionista"]}
- "anime style pero con colores desaturados" → {"estilos": ["anime", "desaturado"]}
- "como un cuadro de Dalí en técnica digital" → {"estilos": ["Dalí", "digital"]}
- "vector art tipo retro futurista" → {"estilos": ["vector art", "retro", "futurista"]}
- "solo un gato bonito" → {"estilos": "sin_estilo"}`

  try {
    const body = {
      model: 'gpt-4.1',
      instructions,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Prompt: ${prompt}\nRespond in json.`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_object',
        },
      },
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.warn('⚠️ Error en OpenAI detectando estilos:', response.status)
      const errorData = await response.text()
      console.warn('📋 Detalle del error:', errorData)
      return { estilos: [], ok: false }
    }

    const data = await response.json()
    console.log('📊 Respuesta raw de OpenAI:', data)

    // Procesar respuesta de Responses API
    let textOut = null
    if (data?.output_text) {
      textOut = data.output_text
    } else if (Array.isArray(data?.output)) {
      const first = data.output[0]?.content?.[0]
      if (first?.type === 'output_text') textOut = first.text
      else if (first?.type === 'text') textOut = first.text
    } else if (Array.isArray(data?.choices)) {
      textOut = data.choices[0]?.message?.content
    }

    console.log('🎨 Respuesta parseada:', textOut)

    // Parsear JSON
    let estilosData
    try {
      estilosData = JSON.parse(textOut)
    } catch (e) {
      console.warn('⚠️ Error parseando JSON de estilos:', textOut)
      return { estilos: [], ok: false }
    }

    // Procesar respuesta
    let estilos = []
    if (Array.isArray(estilosData.estilos)) {
      estilos = estilosData.estilos.filter(s => s && s !== 'sin_estilo')
    } else if (estilosData.estilos === 'sin_estilo') {
      estilos = []
    }

    console.log(`🎨 Estilos detectados (${estilos.length}):`, estilos)

    return {
      estilos: estilos,
      ok: true,
    }
  } catch (error) {
    console.error('❌ Error detectando estilos:', error)
    return { estilos: [], ok: false }
  }
}
