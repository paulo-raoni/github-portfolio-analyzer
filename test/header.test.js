import test from 'node:test';
import assert from 'node:assert/strict';
import { printHeader } from '../src/utils/header.js';

test('printHeader prefers explicit username over process env', () => {
  const originalGithubUsername = process.env.GITHUB_USERNAME;
  process.env.GITHUB_USERNAME = 'env-user';

  const captured = [];
  const originalLog = console.log;
  console.log = (...args) => {
    captured.push(args.join(' '));
  };

  try {
    printHeader({
      command: 'analyze',
      asOfDate: '2026-03-03',
      outputDir: 'output',
      hasToken: true,
      hasPolicy: false,
      username: 'cli-user'
    });
  } finally {
    console.log = originalLog;
    restoreEnv('GITHUB_USERNAME', originalGithubUsername);
  }

  const output = captured.join('\n');
  assert.match(output, /cli-user/);
  assert.doesNotMatch(output, /env-user/);
});

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
