import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { promptMissingKeys } from '../src/config.js';
import { runAnalyzeCommand } from '../src/commands/analyze.js';
import { readJsonFile } from '../src/io/files.js';

test('promptMissingKeys skips all prompts when token is already present in env', { concurrency: false }, async () => {
  const originalToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'test-token';

  try {
    const args = {};
    const result = await promptMissingKeys(args, {
      required: [{ key: 'githubToken', label: 'GitHub Personal Access Token' }],
      optional: [],
      input: new Readable({ read() {} })
    });

    assert.deepEqual(result, args);
  } finally {
    restoreEnv('GITHUB_TOKEN', originalToken);
  }
});

test('runAnalyzeCommand uses env token and writes inventory with forkType, category, and private fields', { concurrency: false }, async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'gpa-analyze-'));
  const outputDir = path.join(workspace, 'output');
  const originalToken = process.env.GITHUB_TOKEN;
  const originalFetch = globalThis.fetch;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const requestedUrls = [];

  process.env.GITHUB_TOKEN = 'test-token';
  console.log = () => {};
  console.error = () => {};
  globalThis.fetch = async (url) => {
    const requestedUrl = String(url);
    const parsed = new globalThis.URL(requestedUrl);
    const requestPath = `${parsed.pathname}${parsed.search}`;
    requestedUrls.push(requestPath);

    if (requestPath === '/user') {
      return jsonResponse({ login: 'octocat' });
    }

    if (requestPath.startsWith('/user/repos?')) {
      return jsonResponse([
        {
          id: 1,
          node_id: 'R_1',
          name: 'pomodoro-clock',
          owner: { login: 'octocat' },
          full_name: 'octocat/pomodoro-clock',
          private: true,
          archived: false,
          fork: true,
          parent: null,
          html_url: 'https://github.com/octocat/pomodoro-clock',
          description: 'A simple timer application',
          language: 'JavaScript',
          homepage: '',
          stargazers_count: 2,
          forks_count: 0,
          open_issues_count: 0,
          size: 120,
          default_branch: 'main',
          topics: [],
          license: { key: 'mit' },
          updated_at: '2026-04-01T00:00:00.000Z',
          pushed_at: '2026-03-20T00:00:00.000Z'
        }
      ]);
    }

    if (requestPath === '/repos/octocat/pomodoro-clock/readme') {
      return jsonResponse({ name: 'README.md' });
    }

    if (requestPath === '/repos/octocat/pomodoro-clock/contents/package.json') {
      return jsonResponse({
        content: Buffer.from(JSON.stringify({
          scripts: {
            test: 'node --test'
          }
        })).toString('base64'),
        encoding: 'base64'
      });
    }

    if (requestPath === '/repos/octocat/pomodoro-clock/contents') {
      return jsonResponse([{ name: 'test' }]);
    }

    if (requestPath === '/repos/octocat/pomodoro-clock/contents/.github/workflows') {
      return jsonResponse([{ name: 'ci.yml' }]);
    }

    throw new Error(`Unexpected fetch URL: ${requestPath}`);
  };

  try {
    await runAnalyzeCommand({
      'as-of': '2026-04-03',
      'output-dir': outputDir
    });
  } finally {
    restoreEnv('GITHUB_TOKEN', originalToken);
    globalThis.fetch = originalFetch;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }

  const inventory = await readJsonFile(path.join(outputDir, 'inventory.json'));
  assert.equal(inventory.meta.owner, 'octocat');
  assert.equal(inventory.meta.asOfDate, '2026-04-03');
  assert.equal(inventory.items.length, 1);

  const item = inventory.items[0];
  assert.equal(item.forkType, 'active');
  assert.equal(item.category, 'product');
  assert.equal(item.private, true);
  assert.equal(item.state, 'active');
  assert.equal(item.activity, 'active');
  assert.equal(requestedUrls.some((url) => url.includes('/compare/')), false);
});

function jsonResponse(body, status = 200) {
  return new globalThis.Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json'
    }
  });
}

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
