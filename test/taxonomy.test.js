import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRepoTaxonomy, buildIdeaTaxonomy } from '../src/core/taxonomy.js';

test('buildRepoTaxonomy returns complete taxonomy contract', () => {
  const taxonomy = buildRepoTaxonomy({ archived: false, activity: 'active' });

  assert.equal(taxonomy.type, 'repo');
  assert.ok(taxonomy.category);
  assert.ok(taxonomy.state);
  assert.ok(taxonomy.strategy);
  assert.ok(taxonomy.effort);
  assert.ok(taxonomy.value);
  assert.ok(taxonomy.nextAction.includes('— Done when:'));
  assert.equal(typeof taxonomy.taxonomyMeta.defaulted, 'boolean');
  assert.ok(taxonomy.taxonomyMeta.sources);
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
