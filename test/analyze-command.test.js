import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { promptMissingKeys } from '../src/config.js';
import { runAnalyzeCommand } from '../src/commands/analyze.js';
import { runReportCommand } from '../src/commands/report.js';
import { buildPortfolio } from '../src/core/portfolio.js';
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

test('runAnalyzeCommand uses env token and writes inventory with forkType, category, private, and languages fields', { concurrency: false }, async () => {
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

    if (requestPath === '/repos/octocat/pomodoro-clock/languages') {
      return jsonResponse({ JavaScript: 12000, CSS: 3400 });
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
  assert.equal(item.forkType, 'passive');
  assert.equal(item.category, 'product');
  assert.equal(item.private, true);
  assert.deepEqual(item.languages, { JavaScript: 12000, CSS: 3400 });
  assert.equal(item.state, 'active');
  assert.equal(item.activity, 'active');
  assert.equal(requestedUrls.some((url) => url.includes('/compare/')), false);
  assert.equal(requestedUrls.includes('/repos/octocat/pomodoro-clock/languages'), true);
});

test('runAnalyzeCommand falls back to empty languages when /languages endpoint fails', { concurrency: false }, async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'gpa-analyze-lang-fail-'));
  const outputDir = path.join(workspace, 'output');
  const originalToken = process.env.GITHUB_TOKEN;
  const originalFetch = globalThis.fetch;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  process.env.GITHUB_TOKEN = 'test-token';
  console.log = () => {};
  console.error = () => {};

  globalThis.fetch = async (url) => {
    const parsed = new globalThis.URL(String(url));
    const requestPath = `${parsed.pathname}${parsed.search}`;

    if (requestPath === '/user') {
      return jsonResponse({ login: 'octocat' });
    }

    if (requestPath.startsWith('/user/repos?')) {
      return jsonResponse([
        {
          id: 2,
          node_id: 'R_2',
          name: 'failing-repo',
          owner: { login: 'octocat' },
          full_name: 'octocat/failing-repo',
          private: false,
          archived: false,
          fork: false,
          parent: null,
          html_url: 'https://github.com/octocat/failing-repo',
          description: null,
          language: 'Go',
          homepage: '',
          stargazers_count: 0,
          forks_count: 0,
          open_issues_count: 0,
          size: 80,
          default_branch: 'main',
          topics: [],
          license: null,
          updated_at: '2026-04-01T00:00:00.000Z',
          pushed_at: '2026-03-01T00:00:00.000Z'
        }
      ]);
    }

    if (requestPath === '/repos/octocat/failing-repo/readme') {
      return jsonResponse({ name: 'README.md' });
    }

    if (requestPath === '/repos/octocat/failing-repo/contents/package.json') {
      return new globalThis.Response(null, { status: 404 });
    }

    if (requestPath === '/repos/octocat/failing-repo/contents') {
      return jsonResponse([]);
    }

    if (requestPath === '/repos/octocat/failing-repo/contents/.github/workflows') {
      return new globalThis.Response(null, { status: 404 });
    }

    if (requestPath === '/repos/octocat/failing-repo/languages') {
      throw new Error('API rate limit exceeded');
    }

    throw new Error(`Unexpected fetch URL: ${requestPath}`);
  };

  try {
    await runAnalyzeCommand({ 'as-of': '2026-04-03', 'output-dir': outputDir });
  } finally {
    restoreEnv('GITHUB_TOKEN', originalToken);
    globalThis.fetch = originalFetch;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }

  const inventory = await readJsonFile(path.join(outputDir, 'inventory.json'));
  assert.equal(inventory.items.length, 1);
  const item = inventory.items[0];
  assert.deepEqual(item.languages, {});
});

test('languages field survives the full inventory → portfolio → report pipeline', { concurrency: false }, async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'gpa-e2e-languages-'));
  const outputDir = path.join(workspace, 'output');
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, 'inventory.json'),
    JSON.stringify({
      meta: {
        generatedAt: '2026-04-03T00:00:00.000Z',
        asOfDate: '2026-04-03',
        owner: 'octocat',
        count: 1
      },
      items: [
        {
          slug: 'octocat/my-app',
          name: 'my-app',
          ownerLogin: 'octocat',
          fullName: 'octocat/my-app',
          private: false,
          fork: false,
          forkType: null,
          archived: false,
          htmlUrl: 'https://github.com/octocat/my-app',
          description: 'A sample app',
          language: 'TypeScript',
          languages: { TypeScript: 20000, CSS: 5000, JavaScript: 1000 },
          topics: [],
          homepage: null,
          stargazersCount: 5,
          forksCount: 0,
          openIssuesCount: 0,
          sizeKb: 300,
          defaultBranch: 'main',
          hasLicense: true,
          structuralHealth: {
            hasReadme: true,
            hasPackageJson: true,
            hasCi: true,
            hasTests: true
          },
          activity: 'active',
          maturity: 'mature',
          score: 82,
          scoreBreakdown: {},
          state: 'active',
          category: 'product',
          strategy: 'maintenance',
          effort: 'm',
          value: 'high',
          nextAction: 'Ship v2 — Done when: release notes are published.',
          taxonomyMeta: {
            defaulted: false,
            sources: {
              category: 'user',
              state: 'inferred',
              strategy: 'default',
              effort: 'default',
              value: 'default',
              nextAction: 'default'
            }
          }
        }
      ]
    }),
    'utf8'
  );

  await buildPortfolio({ 'output-dir': outputDir });

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalStdoutWrite = process.stdout.write;
  console.log = () => {};
  console.error = () => {};
  process.stdout.write = () => true;
  try {
    await runReportCommand({ 'output-dir': outputDir, format: 'json', quiet: true });
  } finally {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.stdout.write = originalStdoutWrite;
  }

  const report = await readJsonFile(path.join(outputDir, 'portfolio-report.json'));
  assert.equal(report.items.length, 1);
  const item = report.items[0];

  assert.deepEqual(item.languages, { TypeScript: 20000, CSS: 5000, JavaScript: 1000 });
  assert.equal(item.private, false);
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
