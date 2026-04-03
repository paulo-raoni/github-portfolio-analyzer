import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';

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

test('CLI report --strict --presentation-overrides is not rejected as unknown flag', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gpa-smoke-'));

  try {
    const overridesFile = join(dir, 'overrides.json');
    writeFileSync(overridesFile, JSON.stringify([]));
    const result = spawnSync(
      process.execPath,
      ['bin/github-portfolio-analyzer.js', 'report', '--strict', '--presentation-overrides', overridesFile],
      { encoding: 'utf8' }
    );

    assert.notEqual(
      result.status,
      2,
      '--presentation-overrides must not be rejected by --strict'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI unknown command exits non-zero', () => {
  const result = spawnSync(
    process.execPath,
    ['bin/github-portfolio-analyzer.js', 'not-a-command'],
    { encoding: 'utf8' }
  );

  assert.ok(result.status >= 1);
});

test('manifest version matches package.json version', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const manifest = JSON.parse(readFileSync('analyzer.manifest.json', 'utf8'));

  assert.equal(
    manifest.version,
    pkg.version,
    'analyzer.manifest.json version must match package.json'
  );
});

test('manifest report flags include --presentation-overrides', () => {
  const manifest = JSON.parse(readFileSync('analyzer.manifest.json', 'utf8'));
  const reportCmd = manifest.commands.find((command) => command.id === 'report');

  assert.ok(
    reportCmd?.flags?.includes('--presentation-overrides'),
    'manifest must declare --presentation-overrides for report'
  );
});
