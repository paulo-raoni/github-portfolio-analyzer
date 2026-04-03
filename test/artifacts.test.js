import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { writeInventoryCsv } from '../src/io/csv.js';
import { writePortfolioSummary, writeProjectMarkdownFiles } from '../src/io/markdown.js';

function makeItem(overrides = {}) {
  return {
    id: 1,
    slug: 'test-repo',
    fullName: 'owner/test-repo',
    type: 'repo',
    title: 'Test Repo',
    score: 80,
    state: 'active',
    effort: 'm',
    value: 'medium',
    category: 'tooling',
    strategy: 'maintenance',
    activity: 'high',
    maturity: 'structured',
    language: 'JavaScript',
    stargazersCount: 5,
    sizeKb: 200,
    private: false,
    fork: false,
    archived: false,
    nextAction: 'Ship improvement — Done when: PR merged.',
    ...overrides
  };
}

test('writeInventoryCsv cria arquivo com header correto', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gpa-csv-'));
  const outputDir = path.join(dir, 'output');
  await mkdir(outputDir, { recursive: true });

  await writeInventoryCsv(outputDir, [makeItem()]);

  const csv = await readFile(path.join(outputDir, 'inventory.csv'), 'utf8');
  const lines = csv.trim().split('\n');
  assert.ok(lines.length >= 2, 'deve ter header + pelo menos 1 linha de dados');
  assert.ok(lines[0].includes('fullName'), 'header deve incluir fullName');
});

test('writeInventoryCsv escapa vírgula em campos', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gpa-csv-comma-'));
  const outputDir = path.join(dir, 'output');
  await mkdir(outputDir, { recursive: true });

  await writeInventoryCsv(outputDir, [makeItem({ fullName: 'Foo, Bar Project' })]);

  const csv = await readFile(path.join(outputDir, 'inventory.csv'), 'utf8');
  assert.ok(csv.includes('"Foo, Bar Project"'), 'vírgula em campo deve ser quoted');
});

test('writeInventoryCsv escapa aspas duplas em campos', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gpa-csv-quotes-'));
  const outputDir = path.join(dir, 'output');
  await mkdir(outputDir, { recursive: true });

  await writeInventoryCsv(outputDir, [makeItem({ fullName: 'Say "hello" project' })]);

  const csv = await readFile(path.join(outputDir, 'inventory.csv'), 'utf8');
  assert.ok(csv.includes('""hello""'), 'aspas duplas devem ser escapadas como ""');
});

test('writeProjectMarkdownFiles cria um arquivo por slug', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gpa-md-'));
  const outputDir = path.join(dir, 'output');
  await mkdir(path.join(outputDir, 'projects'), { recursive: true });

  await writeProjectMarkdownFiles(outputDir, [
    makeItem({ slug: 'alpha' }),
    makeItem({ slug: 'beta' })
  ]);

  const alpha = await readFile(path.join(outputDir, 'projects', 'alpha.md'), 'utf8');
  const beta = await readFile(path.join(outputDir, 'projects', 'beta.md'), 'utf8');
  assert.ok(alpha.length > 0);
  assert.ok(beta.length > 0);
});

test('writeProjectMarkdownFiles resolve colisão de slug duplicado', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gpa-md-dup-'));
  const outputDir = path.join(dir, 'output');
  await mkdir(path.join(outputDir, 'projects'), { recursive: true });

  await writeProjectMarkdownFiles(outputDir, [
    makeItem({ slug: 'dup', type: 'repo' }),
    makeItem({ slug: 'dup', type: 'idea' })
  ]);

  const files = readdirSync(path.join(outputDir, 'projects'));
  assert.equal(files.length, 2, 'dois itens com slug duplicado devem gerar 2 arquivos distintos');
});

test('writePortfolioSummary cria portfolio-summary.md', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gpa-summary-'));
  const outputDir = path.join(dir, 'output');
  await mkdir(outputDir, { recursive: true });

  await writePortfolioSummary(outputDir, {
    generatedAt: '2026-04-03T00:00:00.000Z',
    asOfDate: '2026-04-03',
    items: [makeItem()]
  });

  const summary = await readFile(path.join(outputDir, 'portfolio-summary.md'), 'utf8');
  assert.ok(summary.includes('Portfolio Summary'));
  assert.ok(summary.includes('test-repo') || summary.includes('Test Repo'));
});
