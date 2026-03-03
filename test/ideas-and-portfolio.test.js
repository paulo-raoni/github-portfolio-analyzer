import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { ingestIdeas } from '../src/core/ideas.js';
import { buildPortfolio } from '../src/core/portfolio.js';
import { readJsonFile } from '../src/io/files.js';

test('ingestIdeas writes taxonomy fields and normalized nextAction marker', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'gpa-ideas-'));
  const ideasDir = path.join(workspace, 'ideas');
  const outputDir = path.join(workspace, 'output');
  await mkdir(ideasDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    path.join(ideasDir, 'input.json'),
    JSON.stringify([
      {
        title: 'CLI UX Enhancer',
        problem: 'CLI workflows are unclear for first-time users.',
        nextAction: 'Define command help text - Done when: examples cover all supported subcommands.'
      }
    ], null, 2),
    'utf8'
  );

  await ingestIdeas({ input: path.join(ideasDir, 'input.json'), 'output-dir': outputDir });

  const ideas = await readJsonFile(path.join(outputDir, 'ideas.json'));
  assert.equal(Array.isArray(ideas.items), true);
  assert.equal(ideas.items.length, 1);

  const idea = ideas.items[0];
  assert.equal(idea.type, 'idea');
  assert.ok(idea.category);
  assert.ok(idea.state);
  assert.ok(idea.strategy);
  assert.ok(idea.effort);
  assert.ok(idea.value);
  assert.ok(idea.taxonomyMeta);
  assert.ok(idea.nextAction.includes('— Done when:'));
});

test('buildPortfolio sets meta.asOfDate to null when inventory is missing', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'gpa-portfolio-missing-'));
  const outputDir = path.join(workspace, 'output');
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, 'ideas.json'),
    JSON.stringify({
      meta: { generatedAt: '2026-03-03T00:00:00.000Z', count: 1 },
      items: [
        {
          id: 'idea:test',
          slug: 'test-idea',
          title: 'Test Idea',
          status: 'idea',
          category: 'tooling',
          state: 'idea',
          strategy: 'parked',
          effort: 'm',
          value: 'medium',
          nextAction: 'Define MVP — Done when: acceptance checks are written.',
          type: 'idea',
          taxonomyMeta: {
            defaulted: false,
            sources: {
              category: 'user',
              state: 'user',
              strategy: 'user',
              effort: 'user',
              value: 'user',
              nextAction: 'user'
            }
          },
          score: 80
        }
      ]
    }, null, 2),
    'utf8'
  );

  await buildPortfolio({ 'output-dir': outputDir });
  const portfolio = await readJsonFile(path.join(outputDir, 'portfolio.json'));

  assert.equal(portfolio.meta.asOfDate, null);
  assert.equal(portfolio.items[0].type, 'idea');
  assert.ok(portfolio.items[0].nextAction.includes('— Done when:'));
});

test('buildPortfolio preserves repo taxonomy contract and deterministic order', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'gpa-portfolio-order-'));
  const outputDir = path.join(workspace, 'output');
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, 'inventory.json'),
    JSON.stringify({
      meta: { generatedAt: '2026-03-03T00:00:00.000Z', asOfDate: '2026-03-03', count: 2 },
      items: [
        {
          id: 2,
          name: 'repo-b',
          fullName: 'owner/repo-b',
          slug: 'owner-repo-b',
          type: 'repo',
          category: 'tooling',
          state: 'active',
          strategy: 'maintenance',
          effort: 'm',
          value: 'medium',
          nextAction: 'Ship docs refresh — Done when: README run steps are validated.',
          taxonomyMeta: {
            defaulted: true,
            sources: {
              category: 'default',
              state: 'inferred',
              strategy: 'default',
              effort: 'default',
              value: 'default',
              nextAction: 'default'
            }
          },
          score: 70
        },
        {
          id: 1,
          name: 'repo-a',
          fullName: 'owner/repo-a',
          slug: 'owner-repo-a',
          type: 'repo',
          category: 'tooling',
          state: 'stale',
          strategy: 'maintenance',
          effort: 'm',
          value: 'medium',
          nextAction: 'Refresh setup instructions — Done when: fresh environment run is successful.',
          taxonomyMeta: {
            defaulted: true,
            sources: {
              category: 'default',
              state: 'inferred',
              strategy: 'default',
              effort: 'default',
              value: 'default',
              nextAction: 'default'
            }
          },
          score: 90
        }
      ]
    }, null, 2),
    'utf8'
  );

  await buildPortfolio({ 'output-dir': outputDir });
  const portfolio = await readJsonFile(path.join(outputDir, 'portfolio.json'));

  assert.equal(portfolio.meta.asOfDate, '2026-03-03');
  assert.equal(portfolio.items[0].slug, 'owner-repo-a');
  assert.equal(portfolio.items[1].slug, 'owner-repo-b');

  for (const item of portfolio.items) {
    assert.equal(item.type, 'repo');
    assert.ok(item.category);
    assert.ok(item.state);
    assert.ok(item.strategy);
    assert.ok(item.effort);
    assert.ok(item.value);
    assert.ok(item.taxonomyMeta);
    assert.ok(item.nextAction.includes('— Done when:'));
  }
});
