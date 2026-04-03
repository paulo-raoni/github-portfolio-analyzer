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

test('inferRepoCategory: experiment takes priority over library when name has poc', () => {
  const taxonomy = buildRepoTaxonomy({
    archived: false,
    activity: 'active',
    name: 'using-sequelize-poc',
    description: 'Utilization of sequelize-poc as a library',
    topics: []
  });

  assert.equal(taxonomy.category, 'experiment');
});

test('inferRepoCategory: library wins when poc is only in description, not name', () => {
  const taxonomy = buildRepoTaxonomy({
    archived: false,
    activity: 'active',
    name: 'foo-sdk',
    description: 'Proof of concept SDK for Foo API',
    topics: []
  });

  assert.equal(taxonomy.category, 'library');
});

test('inferRepoCategory: clock/calculator/game repos → product', () => {
  for (const name of ['pomodoro-clock', 'simple-calculator', 'tic-tac-toe-game', 'wikipedia-viewer']) {
    const taxonomy = buildRepoTaxonomy({
      archived: false,
      activity: 'active',
      name,
      description: '',
      topics: []
    });

    assert.equal(taxonomy.category, 'product', `${name} should be product`);
  }
});

test('inferRepoCategory: conservative names without strong learning signals fall back to tooling', () => {
  for (const name of ['open-enrollment-classes-introduction-to-github', 'python-essencial-material']) {
    const taxonomy = buildRepoTaxonomy({
      archived: false,
      activity: 'active',
      name,
      description: '',
      topics: []
    });

    assert.equal(taxonomy.category, 'tooling', `${name} should be tooling`);
  }
});

test('inferRepoCategory: unambiguous learning keywords still map to learning', () => {
  for (const name of ['learn-nodejs', 'javascript-course', 'fizzbuzz-kata']) {
    const taxonomy = buildRepoTaxonomy({
      archived: false,
      activity: 'active',
      name,
      description: '',
      topics: []
    });

    assert.equal(taxonomy.category, 'learning', `${name} should be learning`);
  }
});

test('dormant state maps to correct next action', () => {
  const taxonomy = buildRepoTaxonomy({
    archived: false,
    activity: 'dormant'
  });

  assert.equal(taxonomy.state, 'dormant');
  assert.ok(taxonomy.nextAction.includes('Done when:'));
});

test('manual abandoned state remains supported for curated items', () => {
  const taxonomy = buildRepoTaxonomy({
    archived: false,
    activity: 'abandoned'
  });

  assert.equal(taxonomy.state, 'abandoned');
  assert.ok(taxonomy.nextAction.includes('Done when:'));
});

test('buildIdeaTaxonomy preserves abandoned state for ideas with status abandoned', () => {
  const taxonomy = buildIdeaTaxonomy({ status: 'abandoned' });

  assert.equal(taxonomy.state, 'abandoned');
  assert.notEqual(taxonomy.state, 'dormant');
});

test('buildIdeaTaxonomy maps status dormant to dormant state', () => {
  const taxonomy = buildIdeaTaxonomy({ status: 'dormant' });

  assert.equal(taxonomy.state, 'dormant');
});
