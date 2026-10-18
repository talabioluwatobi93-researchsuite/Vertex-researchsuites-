type Result = { content: string; providerUsed: string }

const TIMEOUT_MS = 45000

async function callModel(model: string, prompt: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('CONFIG_ERROR: missing OPENROUTER_API_KEY')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        stream: false,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    if (res.status === 401) throw new Error('CONFIG_ERROR: invalid or missing OPENROUTER_API_KEY')
    if (!res.ok) throw new Error('OpenRouter ' + model + ' failed: ' + res.status)
    const data: any = await res.json()
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
    if (typeof text !== 'string' || !text.trim()) throw new Error('empty reply from ' + model)
    return text
  } finally {
    clearTimeout(timer)
  }
}

function numbersIn(text: string): string[] {
  const t = text.replace(/(\d),(\d{3})/g, '$1$2')
  return t.match(/\d+(?:\.\d+)?|\.\d+/g) || []
}

function decimalsOf(tok: string): number {
  const i = tok.indexOf('.')
  return i === -1 ? 0 : tok.length - i - 1
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[_\s]+/g, ' ').trim()
}

function roundsTo(a: number, v: number, d: number): boolean {
  return Math.abs(Number(a.toFixed(d)) - v) < 1e-9
}

function check(text: string, prompt: string): string | null {
  const clean = text.replace(/```json|```/g, '').trim()
  let parsed: any
  try {
    parsed = JSON.parse(clean)
  } catch (e) {
    return 'reply is not valid JSON'
  }
  const rep = parsed && parsed.pilot_study_report
  if (!rep || typeof rep !== 'object') return 'pilot_study_report missing'

  const block = prompt.split('TASK:')[0]
  const exact: number[] = numbersIn(block).map(parseFloat)
  for (const t of [0.6, 0.7, 0.8, 0.9]) exact.push(t)
  const derived: number[] = []
  const line = block.split('\n').find(l => l.indexOf('Questionnaires Shared') !== -1)
  if (line) {
    const n = numbersIn(line).map(parseFloat)
    if (n.length >= 2 && n[0] > 0) {
      derived.push((n[1] / n[0]) * 100, n[1] / n[0], n[0] - n[1])
    }
  }

  const bad: string[] = []
  for (const tok of numbersIn(clean)) {
    const v = parseFloat(tok)
    const d = decimalsOf(tok)
    const okExact = exact.some(a => (d === 0 ? a === v : roundsTo(a, v, d)))
    const okDerived = derived.some(a => roundsTo(a, v, d))
    if (!okExact && !okDerived) bad.push(tok)
  }
  if (bad.length) return 'numbers not in the input: ' + bad.slice(0, 5).join(', ')

  const evals: any[] = Array.isArray(rep.construct_evaluations) ? rep.construct_evaluations : []
  const blockNorm = norm(block)
  for (const c of evals) {
    const name = norm(String((c && c.construct_name) || ''))
    if (!name || blockNorm.indexOf(name) === -1) return 'construct name not in the input'
    const nums = numbersIn(String((c && c.alpha_score) || ''))
    if (nums.length === 0) return 'alpha score missing for a construct'
    const alpha = parseFloat(nums[0])
    const status = String((c && c.status) || '').toLowerCase()
    const unreliable = status.indexOf('unreliable') !== -1
    if (alpha >= 0.7 && unreliable) return 'status contradicts the alpha score'
    if (alpha < 0.7 && !unreliable) return 'status contradicts the alpha score'
  }
  return null
}

export async function callPilotInterpret(prompt: string): Promise<Result> {
  const models = [
    { id: process.env.PILOT_MODEL_PRIMARY || 'anthropic/claude-sonnet-5', label: 'sonnet5-openrouter' },
    { id: process.env.PILOT_MODEL_FALLBACK || 'deepseek/deepseek-v4-pro-0813', label: 'deepseek-fallback' },
  ]
  let lastErr: any = null
  for (const m of models) {
    try {
      const text = await callModel(m.id, prompt)
      const problem = check(text, prompt)
      if (problem) {
        console.error('Pilot interpretation rejected (' + m.label + '): ' + problem)
        lastErr = new Error('REJECTED: ' + problem)
        continue
      }
      return { content: text, providerUsed: m.label }
    } catch (err: any) {
      if (String(err && err.message).startsWith('CONFIG_ERROR')) throw err
      console.error('Pilot interpretation failed (' + m.label + '):', err)
      lastErr = err
    }
  }
  throw lastErr || new Error('Pilot interpretation failed')
}
