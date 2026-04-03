import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPublicAliasLLMCaller,
  generatePublicAlias
} from '../src/core/publicAliasGenerator.js';

test('generatePublicAlias preserves manual alias and sanitizes LLM output', async () => {
  assert.equal(
    await generatePublicAlias(
      { private: true, publicAlias: 'manual-alias' },
      async () => 'should-not-run'
    ),
    'manual-alias'
  );

  const alias = await generatePublicAlias(
    {
      private: true,
      category: 'tooling',
      language: 'TypeScript',
      topics: ['queue']
    },
    async () => ' Internal Queue Console!!! '
  );

  assert.equal(alias, 'internal-queue-console');
});

test('createPublicAliasLLMCaller falls back from OpenAI to Gemini', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  const ResponseCtor = globalThis.Response;

  globalThis.fetch = async (url) => {
    calls.push(String(url));

    if (String(url).includes('api.openai.com')) {
      return new ResponseCtor(
        JSON.stringify({ error: { message: 'bad key' } }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' }
        }
      );
    }

    return new ResponseCtor(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: 'relay-task-engine' }]
            }
          }
        ]
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  };

  try {
    const callLLM = createPublicAliasLLMCaller({
      openaiKey: 'openai-key',
      geminiKey: 'gemini-key'
    });

    assert.equal(typeof callLLM, 'function');
    assert.equal(await callLLM('prompt'), 'relay-task-engine');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.some((url) => url.includes('api.openai.com')), true);
  assert.equal(calls.some((url) => url.includes('generativelanguage.googleapis.com')), true);
});

test('createPublicAliasLLMCaller returns null when no provider keys are configured', () => {
  assert.equal(createPublicAliasLLMCaller({}), null);
});
