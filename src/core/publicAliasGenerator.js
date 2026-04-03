const OPENAI_URL = 'https://api.openai.com/v1/responses';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Generates a plausible, non-identifying alias for private repositories.
 * Preserves manually curated aliases when present.
 */
export async function generatePublicAlias(item, callLLM) {
  if (!item?.private) {
    return null;
  }

  if (item.publicAlias) {
    return item.publicAlias;
  }

  if (typeof callLLM !== 'function') {
    return null;
  }

  const prompt = [
    'Given a private software project with:',
    `- category: ${item.category ?? 'unknown'}`,
    `- language: ${item.language ?? 'unknown'}`,
    `- topics: ${Array.isArray(item.topics) ? item.topics.join(', ') : 'none'}`,
    `- description: "${String(item.description ?? '').substring(0, 200)}"`,
    '',
    'Generate a plausible but fictional project slug (2-3 words, kebab-case).',
    'Must reflect the technical domain. Must NOT contain: original repo name,',
    'company names, client names, person names, or any identifying information.',
    'Return ONLY the slug, nothing else. Example: "relay-task-engine"'
  ].join('\n');

  try {
    const raw = await callLLM(prompt);
    return (
      raw
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || null
    );
  } catch {
    return null;
  }
}

export function createPublicAliasLLMCaller(env = {}) {
  const providers = [];

  if (env.openaiKey) {
    providers.push((prompt) => callOpenAI(env.openaiKey, prompt));
  }

  if (env.geminiKey) {
    providers.push((prompt) => callGemini(env.geminiKey, prompt));
  }

  if (env.anthropicKey) {
    providers.push((prompt) => callAnthropic(env.anthropicKey, prompt));
  }

  if (providers.length === 0) {
    return null;
  }

  return async function callLLM(prompt) {
    let lastError = null;

    for (const provider of providers) {
      try {
        const value = await provider(prompt);
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  };
}

async function callOpenAI(apiKey, prompt) {
  const data = await postJson(
    OPENAI_URL,
    {
      model: 'gpt-4.1-mini',
      input: prompt,
      max_output_tokens: 40
    },
    {
      Authorization: `Bearer ${apiKey}`
    }
  );

  return extractOpenAIText(data);
}

async function callGemini(apiKey, prompt) {
  const data = await postJson(
    `${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`,
    {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 40
      }
    }
  );

  return data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text ?? '')
    .join('')
    .trim();
}

async function callAnthropic(apiKey, prompt) {
  const data = await postJson(
    ANTHROPIC_URL,
    {
      model: 'claude-3-5-haiku-latest',
      max_tokens: 40,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  );

  return data?.content
    ?.map((part) => (part?.type === 'text' ? part.text : ''))
    .join('')
    .trim();
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });

  const data = await safeJson(response);
  if (!response.ok) {
    const details = data?.error?.message ?? data?.message ?? response.statusText;
    throw new Error(`LLM request failed: ${response.status} ${details}`.trim());
  }

  return data;
}

async function safeJson(response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractOpenAIText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  for (const output of data?.output ?? []) {
    for (const content of output?.content ?? []) {
      if (typeof content?.text === 'string' && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return null;
}
