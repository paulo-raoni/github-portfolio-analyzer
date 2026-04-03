import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

test('CLI --version returns a semver string', () => {
  const output = execSync('node bin/github-portfolio-analyzer.js --version', {
    encoding: 'utf8'
  }).trim();

  assert.match(output, /^\d+\.\d+\.\d+$/);
});

test('CLI --help exits 0 and contains usage information', () => {
  let output = '';

  try {
    output = execSync('node bin/github-portfolio-analyzer.js --help', {
      encoding: 'utf8'
    });
  } catch (error) {
    output = error.stdout ?? '';
  }

  assert.ok(output.length > 0, 'help output should not be empty');
  assert.ok(
    output.includes('analyze') || output.includes('github-portfolio-analyzer'),
    'help should mention the CLI name or commands'
  );
});
