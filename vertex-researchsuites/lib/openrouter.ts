type OpenRouterResult = { content: string; providerUsed: string };

async function callOpenRouterStreaming(model: string, prompt: string, timeoutMs?: number): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
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
    primary: 'anthropic/claude-sonnet-4.6',
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

export const QUANT_INTERPRET_MODEL_ROUTES = {
  primary: 'anthropic/claude-sonnet-4.6',
  fallback: 'openai/gpt-4o-mini',
};

export async function callQuantInterpretChain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(QUANT_INTERPRET_MODEL_ROUTES.primary, prompt);
    return { content, providerUsed: 'sonnet5-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Quant Interpret primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(QUANT_INTERPRET_MODEL_ROUTES.fallback, prompt);
    return { content, providerUsed: 'gpt4o-mini-fallback' };
  }
}

export const QUANT_CHAPTER5_MODEL_ROUTES = {
  primary: 'google/gemini-2.5-flash',
  fallback: 'deepseek/deepseek-v4-pro',
};

export async function callQuantChapter5Chain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(QUANT_CHAPTER5_MODEL_ROUTES.primary, prompt);
    return { content, providerUsed: 'gemini25flash-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Quant Chapter 5 primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(QUANT_CHAPTER5_MODEL_ROUTES.fallback, prompt);
    return { content, providerUsed: 'deepseek-fallback' };
  }
}

export const QUAL_CHAPTER5_MODEL_ROUTES = {
  primary: 'google/gemini-2.5-flash',
  fallback: 'deepseek/deepseek-v4-pro',
};

export async function callQualChapter5Chain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(QUAL_CHAPTER5_MODEL_ROUTES.primary, prompt);
    return { content, providerUsed: 'gemini25flash-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Qual Chapter 5 primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(QUAL_CHAPTER5_MODEL_ROUTES.fallback, prompt);
    return { content, providerUsed: 'deepseek-fallback' };
  }
}

export const QUAL_STEP1_MODEL_ROUTES = {
  primary: 'deepseek/deepseek-v4-pro',
  fallback: 'openai/gpt-4o-mini',
};

export async function callQualStep1Chain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(QUAL_STEP1_MODEL_ROUTES.primary, prompt);
    return { content, providerUsed: 'deepseek-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Qual Step 1 primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(QUAL_STEP1_MODEL_ROUTES.fallback, prompt);
    return { content, providerUsed: 'gpt4o-mini-fallback' };
  }
}

export const QUAL_STEP2_MODEL_ROUTES = {
  primary: 'moonshotai/kimi-k3',
  fallback: 'anthropic/claude-sonnet-4.6',
};

export async function callQualStep2Chain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(QUAL_STEP2_MODEL_ROUTES.primary, prompt);
    return { content, providerUsed: 'kimi-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Qual Step 2 primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(QUAL_STEP2_MODEL_ROUTES.fallback, prompt);
    return { content, providerUsed: 'sonnet5-fallback' };
  }
}


export const QUAL_INTERPRET_MODEL_ROUTES = {
  primary: 'anthropic/claude-sonnet-4.6',
  fallback: 'openai/gpt-4o-mini',
};

export async function callQualInterpretChain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(QUAL_INTERPRET_MODEL_ROUTES.primary, prompt);
    return { content, providerUsed: 'sonnet5-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Qual Interpret primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(QUAL_INTERPRET_MODEL_ROUTES.fallback, prompt);
    return { content, providerUsed: 'gpt4o-mini-fallback' };
  }
}
export const VOICE_INTERPRET_MODEL_ROUTES = {
  primary: 'deepseek/deepseek-v4-pro',
  fallbackA: 'moonshotai/kimi-k3',
  fallbackB: 'anthropic/claude-sonnet-4.6',
};

export async function callVoiceInterpretChain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(VOICE_INTERPRET_MODEL_ROUTES.primary, prompt, 120000);
    return { content, providerUsed: 'deepseek-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Voice Interpret primary failed, falling back to Kimi:', err);
    try {
      const content = await callOpenRouterStreaming(VOICE_INTERPRET_MODEL_ROUTES.fallbackA, prompt, 75000);
      return { content, providerUsed: 'kimi-fallback' };
    } catch (err2: any) {
      if (String(err2.message).startsWith('CONFIG_ERROR')) throw err2;
      console.error('Voice Interpret Kimi fallback failed, falling back to Sonnet:', err2);
      const content = await callOpenRouterStreaming(VOICE_INTERPRET_MODEL_ROUTES.fallbackB, prompt, 75000);
      return { content, providerUsed: 'sonnet5-fallback' };
    }
  }
}

export const QUANT_RECOMMEND_MODEL_ROUTES = {
  primary: 'anthropic/claude-sonnet-4.6',
  fallback: 'openai/gpt-4o-mini',
};

export async function callQuantRecommendChain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(QUANT_RECOMMEND_MODEL_ROUTES.primary, prompt);
    return { content, providerUsed: 'sonnet5-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Quant Recommend primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(QUANT_RECOMMEND_MODEL_ROUTES.fallback, prompt);
    return { content, providerUsed: 'gpt4o-mini-fallback' };
  }
}

export const QUANT_QUESTIONNAIRE_MAP_MODEL_ROUTES = {
  primary: 'anthropic/claude-sonnet-4.6',
  fallback: 'openai/gpt-4o-mini',
};

export async function callQuestionnaireMapChain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(QUANT_QUESTIONNAIRE_MAP_MODEL_ROUTES.primary, prompt);
    return { content, providerUsed: 'sonnet5-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Questionnaire Map primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(QUANT_QUESTIONNAIRE_MAP_MODEL_ROUTES.fallback, prompt);
    return { content, providerUsed: 'gpt4o-mini-fallback' };
  }
}

export const QUANT_CHAPTER3_EXTRACT_MODEL_ROUTES = {
  primary: 'anthropic/claude-sonnet-4.6',
  fallback: 'openai/gpt-4o-mini',
};

export async function callChapter3ExtractChain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(QUANT_CHAPTER3_EXTRACT_MODEL_ROUTES.primary, prompt);
    return { content, providerUsed: 'sonnet5-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Chapter 3 Extract primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(QUANT_CHAPTER3_EXTRACT_MODEL_ROUTES.fallback, prompt);
    return { content, providerUsed: 'gpt4o-mini-fallback' };
  }
}

export const TOPICS_MODEL_ROUTES = {
  primary: 'openai/gpt-4o-mini',
  fallback: 'anthropic/claude-sonnet-4.6',
};

export async function callTopicsChain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(TOPICS_MODEL_ROUTES.primary, prompt);
    return { content, providerUsed: 'gpt4o-mini-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Topics primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(TOPICS_MODEL_ROUTES.fallback, prompt);
    return { content, providerUsed: 'sonnet5-fallback' };
  }
}

export const PROPOSAL_MODEL_ROUTES = {
  primary: 'deepseek/deepseek-v4-pro',
  fallback: 'openai/gpt-4o-mini',
};

export async function callProposalChain(prompt: string): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(PROPOSAL_MODEL_ROUTES.primary, prompt);
    return { content, providerUsed: 'deepseek-openrouter' };
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err;
    console.error('Proposal primary failed, falling back:', err);
    const content = await callOpenRouterStreaming(PROPOSAL_MODEL_ROUTES.fallback, prompt);
    return { content, providerUsed: 'gpt4o-mini-fallback' };
  }
}

// ---- Phase 9: dual-coder qualitative analysis (Rev2 Section 4) ----
// Coder A: Gemini 3.1 Pro (Preview) -> falls back to DeepSeek V4 Pro 0813.
export const QUAL_CODER_A_MODEL_ROUTES = {
  primary: 'google/gemini-3.1-pro-preview',
  fallback: 'deepseek/deepseek-v4-pro-0813',
}

export async function callQualCoderAChain(prompt: string, timeoutMs: number = 45000): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(QUAL_CODER_A_MODEL_ROUTES.primary, prompt, timeoutMs)
    return { content, providerUsed: 'gemini31-openrouter' }
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err
    console.error('Qual Coder A primary failed, falling back:', err)
    const content = await callOpenRouterStreaming(QUAL_CODER_A_MODEL_ROUTES.fallback, prompt, timeoutMs)
    return { content, providerUsed: 'deepseek0813-fallback' }
  }
}

// Coder B: Qwen 72B first, Haiku 5.5 if that fails. Both are a different
// model family from Coder A (Gemini, fallback DeepSeek), so the two coders
// stay independent. The first model gets one attempt, then the fallback.
export const QUAL_CODER_B_MODEL_ROUTES = {
  primary: 'qwen/qwen-2.5-72b-instruct',
  fallback: 'anthropic/claude-haiku-5.5',
}

export async function callQualCoderBChain(prompt: string, timeoutMs: number = 45000): Promise<OpenRouterResult> {
  try {
    const content = await callOpenRouterStreaming(QUAL_CODER_B_MODEL_ROUTES.primary, prompt, timeoutMs)
    return { content, providerUsed: 'coderb-primary' }
  } catch (err: any) {
    if (String(err.message).startsWith('CONFIG_ERROR')) throw err
    console.error('Qual Coder B primary failed, trying fallback:', err)
    const content = await callOpenRouterStreaming(QUAL_CODER_B_MODEL_ROUTES.fallback, prompt, timeoutMs)
    return { content, providerUsed: 'coderb-fallback' }
  }
}
