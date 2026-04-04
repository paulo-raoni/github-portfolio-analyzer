import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReportModel } from '../src/core/report.js';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('analyzer.manifest.json', 'utf8'));
const schema = JSON.parse(readFileSync('schemas/portfolio-report.schema.json', 'utf8'));

test('manifest.version matches package.json version', () => {
  assert.equal(manifest.version, pkg.version);
});

test('manifest declara os 4 comandos CLI e os 3 outputs esperados', () => {
  const ids = manifest.commands.map((command) => command.id);
  assert.ok(ids.includes('analyze'));
  assert.ok(ids.includes('ingest-ideas'));
  assert.ok(ids.includes('build-portfolio'));
  assert.ok(ids.includes('report'));
  assert.ok(manifest.outputs.includes('output/inventory.json'));
  assert.ok(manifest.outputs.includes('output/portfolio.json'));
  assert.ok(manifest.outputs.includes('output/portfolio-report.json'));
});

test('manifest report flags incluem --presentation-overrides', () => {
  const report = manifest.commands.find((command) => command.id === 'report');
  assert.ok(report?.flags?.includes('--presentation-overrides'));
});

test('schema $defs.item declara category com enum', () => {
  const item = schema.$defs?.item;
  assert.ok(item, '$defs.item deve existir');
  assert.ok(item.properties?.category, 'item deve ter propriedade category');
  assert.equal(item.properties.category.type, 'string');
  assert.ok(Array.isArray(item.properties.category.enum));
  const expected = ['product', 'tooling', 'library', 'learning', 'content', 'infra', 'experiment', 'template'];
  for (const value of expected) {
    assert.ok(
      item.properties.category.enum.includes(value),
      `category enum deve incluir '${value}'`
    );
  }
});

test('schema $defs.item state enum inclui dormant', () => {
  const item = schema.$defs?.item;
  const stateEnum = item?.properties?.state?.enum;

  if (stateEnum) {
    assert.ok(stateEnum.includes('dormant'), 'state enum deve incluir dormant');
  }
});

test('schema exige meta, summary, matrix, items no top-level', () => {
  assert.ok(schema.required?.includes('meta'));
  assert.ok(schema.required?.includes('summary'));
  assert.ok(schema.required?.includes('matrix'));
  assert.ok(schema.required?.includes('items'));
  assert.ok(schema.$defs?.item?.required?.includes('private'));
});

test('every report item has private as explicit boolean', () => {
  const report = buildReportModel({
    meta: { asOfDate: '2026-04-03' },
    items: [
      {
        slug: 'public-repo',
        type: 'repo',
        title: 'Public Repo',
        score: 64,
        state: 'active',
        effort: 'm',
        value: 'medium',
        taxonomyMeta: { sources: { effort: 'user' } },
        structuralHealth: {
          hasReadme: true,
          hasPackageJson: true,
          hasCi: false,
          hasTests: false
        },
        sizeKb: 120,
        nextAction: 'Refresh docs — Done when: README is validated.'
      },
      {
        slug: 'private-repo',
        type: 'repo',
        title: 'Private Repo',
        score: 72,
        state: 'active',
        effort: 'm',
        value: 'high',
        private: true,
        taxonomyMeta: { sources: { effort: 'user' } },
        structuralHealth: {
          hasReadme: true,
          hasPackageJson: true,
          hasCi: true,
          hasTests: true
        },
        sizeKb: 240,
        nextAction: 'Ship release — Done when: changelog is published.'
      }
    ]
  });

  for (const item of report.items) {
    assert.ok(
      typeof item.private === 'boolean',
      `item ${item.slug} must have private as boolean, got ${typeof item.private}`
    );
  }
});

test('README não contém en dash (–) dentro de blocos Mermaid', () => {
  const readme = readFileSync('README.md', 'utf8');
  const mermaidBlocks = [...readme.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)]
    .map((match) => match[1]);
  assert.ok(mermaidBlocks.length > 0, 'README deve conter pelo menos um bloco Mermaid');
  for (const block of mermaidBlocks) {
    assert.ok(
      !block.includes('\u2013'),
      `en dash encontrado em bloco Mermaid — substituir por hífen ASCII:\n${block}`
    );
  }
});
