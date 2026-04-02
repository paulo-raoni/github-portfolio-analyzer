import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRepoTaxonomy, buildIdeaTaxonomy } from '../src/core/taxonomy.js';

test('buildRepoTaxonomy returns complete taxonomy contract', () => {
  const taxonomy = buildRepoTaxonomy({
    archived: false,
    activity: 'active',
    name: 'prompt-library',
    description: 'Prompt snippets and docs for AI workflows',
    topics: ['writing', 'resources']
  });

  assert.equal(taxonomy.type, 'repo');
  assert.equal(taxonomy.category, 'content');
  assert.ok(taxonomy.state);
  assert.ok(taxonomy.strategy);
  assert.ok(taxonomy.effort);
  assert.ok(taxonomy.value);
  assert.ok(taxonomy.nextAction.includes('— Done when:'));
  assert.equal(typeof taxonomy.taxonomyMeta.defaulted, 'boolean');
  assert.ok(taxonomy.taxonomyMeta.sources);
  assert.equal(taxonomy.taxonomyMeta.sources.category, 'inferred');
});

test('buildIdeaTaxonomy maps status to state and preserves contract', () => {
  const taxonomy = buildIdeaTaxonomy({
    status: 'on-hold',
    nextAction: 'Define scope - Done when: requirements list is approved.'
  });

  assert.equal(taxonomy.type, 'idea');
  assert.equal(taxonomy.state, 'stale');
  assert.ok(taxonomy.nextAction.includes('— Done when:'));
  assert.ok(taxonomy.taxonomyMeta.sources);
});

test('buildRepoTaxonomy preserves user-specified valid category over inference', () => {
  const taxonomy = buildRepoTaxonomy({
    archived: false,
    activity: 'active',
    name: 'my-app',
    description: 'web platform',
    topics: [],
    category: 'library'
  });

  assert.equal(taxonomy.category, 'library');
  assert.equal(taxonomy.taxonomyMeta.sources.category, 'user');
});

test('buildRepoTaxonomy ignores invalid user-specified category and falls back to inference', () => {
  const taxonomy = buildRepoTaxonomy({
    archived: false,
    activity: 'active',
    name: 'prompt-library',
    description: '',
    topics: [],
    category: 'not-a-valid-category'
  });

  assert.equal(taxonomy.category, 'content');
  assert.equal(taxonomy.taxonomyMeta.sources.category, 'inferred');
});
