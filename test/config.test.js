import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnv, requireGithubToken } from '../src/config.js';

test('getEnv applies CLI-style overrides over process env', () => {
  const originalGithubToken = process.env.GITHUB_TOKEN;
  const originalGithubUsername = process.env.GITHUB_USERNAME;
  const originalOpenAIKey = process.env.OPENAI_API_KEY;

  process.env.GITHUB_TOKEN = 'env-token';
  process.env.GITHUB_USERNAME = 'env-user';
  process.env.OPENAI_API_KEY = 'env-openai';

  try {
    const env = getEnv({
      githubToken: 'arg-token',
      githubUsername: 'arg-user',
      openaiKey: 'arg-openai'
    });

    assert.equal(env.githubToken, 'arg-token');
    assert.equal(env.githubUsername, 'arg-user');
    assert.equal(env.openaiKey, 'arg-openai');
  } finally {
    restoreEnv('GITHUB_TOKEN', originalGithubToken);
    restoreEnv('GITHUB_USERNAME', originalGithubUsername);
    restoreEnv('OPENAI_API_KEY', originalOpenAIKey);
  }
});

test('requireGithubToken reports CLI override guidance in the error message', () => {
  assert.throws(
    () => requireGithubToken({ githubToken: '' }),
    /Missing GITHUB_TOKEN\. Add it to your \.env file or pass --github-token <token>/
  );
});

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
