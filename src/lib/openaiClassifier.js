// Minimal OpenAI Responses API classifier
// Classifies a prompt into multi-label categories and returns a concise summary

/**
 * Categories:
 * - text_heavy: Image primarily composed of text (e.g., typography, poster text)
 * - normal: General scene/object without specific constraints
 * - specific_character: Mentions a specific fictional or real person/character
 * - explicit: Contains sexual explicit content or graphic adult content
 */

export async function classifyPrompt(prompt) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey || !prompt) {
    return { labels: [], reasons: [], ok: false }
  }

  const instructions = `Eres un clasificador estricto de múltiples etiquetas.
Clasifica el prompt de imagen dado en estas categorías: text_heavy, normal, specific_character, explicit.
Te explicaré cada categoría:
- text_heavy: La imagen está compuesta principalmente por texto, como tipografía o texto de póster.
- normal: La imagen representa una escena u objeto general sin restricciones específicas.
- specific_character: La imagen resultante incluiría a un personaje ficticio o real específico (o sea con nombre propio y famoso). Si menciona el estilo de por ejemplo "Van Gogh", no cuenta como un personaje, porque eso es un estilo. 
Si es un tipo de personaje por ejemplo: "un sucubo" o "un vampiro" pero sin especificar alguien exacto, entonces no entra en ésta clasificación
- explicit: La imagen contiene contenido sexual explícito o gráfico para adultos.
Devuelve SOLO json con campos {"labels":[], "reasons":[]}.
Se permiten múltiples etiquetas.
No incluyas nombres de personas reales en las razones; sé genérico como "menciona una celebridad específica".`

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

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      return { labels: [], reasons: [], ok: false, error: `HTTP ${res.status}` }
    }

    const data = await res.json()

    // Responses API shapes
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

    let parsed = null
    if (textOut) {
      try {
        parsed = JSON.parse(textOut)
      } catch {
        const m = textOut.match(/\{[\s\S]*\}/)
        if (m) {
          try { parsed = JSON.parse(m[0]) } catch {}
        }
      }
    }

    if (!parsed || !Array.isArray(parsed.labels)) {
      return { labels: [], reasons: [], ok: false }
    }

    const allowed = new Set(['text_heavy', 'normal', 'specific_character', 'explicit'])
    const labels = (parsed.labels || []).filter((l) => allowed.has(l))
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 3) : []
    return { labels, reasons, ok: true }
  } catch (e) {
    return { labels: [], reasons, ok: false, error: e?.message }
  }
}

export function summarizeLabels(labels) {
  if (!labels?.length) return 'sin clasificación'
  const map = {
    text_heavy: 'texto predominante',
    normal: 'imagen normal',
    specific_character: 'personaje específico',
    explicit: 'contenido explícito',
  }
  return labels.map((l) => map[l] || l).join(', ')
}
