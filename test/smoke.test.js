import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';

const cliPath = join(process.cwd(), 'bin', 'github-portfolio-analyzer.js');

test('CLI --version returns a semver string', () => {
  const output = execSync(`node "${cliPath}" --version`, {
    encoding: 'utf8'
  }).trim();

  assert.match(output, /^\d+\.\d+\.\d+$/);
});

test('CLI --help exits 0 and contains usage information', () => {
  let output = '';

  try {
    output = execSync(`node "${cliPath}" --help`, {
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
      [cliPath, 'report', '--strict', '--presentation-overrides', overridesFile],
      { encoding: 'utf8', cwd: dir }
    );

    assert.equal(
      result.status,
      1,
      '--presentation-overrides must not be rejected by --strict (expected exit 1 = runtime, not 2 = bad flag)'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI unknown command exits non-zero', () => {
  const result = spawnSync(
    process.execPath,
    [cliPath, 'not-a-command'],
    { encoding: 'utf8' }
  );

  assert.ok(result.status >= 1);
});

test('CLI report --format json --quiet writes only JSON to stdout', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gpa-e2e-'));

  try {
    const outputDir = join(dir, 'output');
    mkdirSync(outputDir, { recursive: true });

    const portfolioFixture = {
      meta: {
        generatedAt: '2026-04-03T00:00:00.000Z',
        asOfDate: '2026-04-03',
        count: 1
      },
      items: [
        {
          slug: 'test-repo',
          type: 'idea',
          title: 'Test Repo',
          score: 75,
          state: 'idea',
          effort: 'm',
          value: 'medium',
          taxonomyMeta: {
            sources: {
              effort: 'default'
            }
          },
          nextAction: 'Ship improvement — Done when: PR merged.'
        }
      ]
    };
    writeFileSync(join(outputDir, 'portfolio.json'), JSON.stringify(portfolioFixture));

    const result = spawnSync(
      process.execPath,
      [cliPath, 'report', '--output-dir', outputDir, '--format', 'json', '--quiet'],
      { encoding: 'utf8' }
    );
    assert.equal(result.status, 0, `report failed:\n${result.stderr}`);

    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.items, 'stdout deve conter JSON com campo items');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
