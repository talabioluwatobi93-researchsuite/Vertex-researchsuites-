type OpenRouterResult = { content: string; providerUsed: string };

async function callOpenRouterStreaming(model: string, prompt: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (res.status === 401) throw new Error('CONFIG_ERROR: invalid or missing OPENROUTER_API_KEY');
  if (!res.ok || !res.body) throw new Error(`OpenRouter ${model} failed: ${res.status} ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) fullContent += delta;
      } catch {}
    }
  }
  return fullContent;
}

export const MODEL_ROUTES = {
  pilotStudy: {
    primary: 'anthropic/claude-sonnet-4.5', // ⚠ verify exact slug on openrouter.ai/models
    fallback: 'openai/gpt-4o-mini',
  },
};

export async function callPilotStudyChain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(MODEL_ROUTES.pilotStudy.primary, prompt);
    return { content, providerUsed: 'sonnet5-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Pilot Study primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(MODEL_ROUTES.pilotStudy.fallback, prompt);
    return { content, providerUsed: 'gpt4o-mini-fallback' };
  }
}
