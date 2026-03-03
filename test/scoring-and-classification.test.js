import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyActivity, classifyMaturity } from '../src/core/classification.js';
import { scoreRepository, scoreIdea } from '../src/core/scoring.js';

test('activity classification boundaries are stable', () => {
  const asOf = '2026-03-03';

  assert.equal(classifyActivity('2025-12-03T00:00:00.000Z', asOf), 'active');
  assert.equal(classifyActivity('2025-12-02T00:00:00.000Z', asOf), 'stale');
  assert.equal(classifyActivity('2025-03-03T00:00:00.000Z', asOf), 'stale');
  assert.equal(classifyActivity('2025-03-02T00:00:00.000Z', asOf), 'abandoned');
});

test('maturity classification boundaries are stable', () => {
  assert.equal(classifyMaturity(499), 'experimental');
  assert.equal(classifyMaturity(500), 'early');
  assert.equal(classifyMaturity(5000), 'early');
  assert.equal(classifyMaturity(5001), 'structured');
  assert.equal(classifyMaturity(50000), 'structured');
  assert.equal(classifyMaturity(50001), 'large');
});

test('repository score follows heuristic and clamps to 0..100', () => {
  const repo = {
    pushedAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    stargazersCount: 5,
    structuralHealth: {
      hasReadme: true,
      hasLicense: true,
      hasTests: true
    }
  };

  const scored = scoreRepository(repo, '2026-03-03');
  assert.equal(scored.score, 100);
  assert.equal(scored.scoreBreakdown.hasReadme, 15);
});

test('idea score follows heuristic and clamps to 0..100', () => {
  const scored = scoreIdea({
    problem: 'Problem statement',
    targetUser: 'Developers',
    mvp: 'One CLI command',
    nextAction: 'Ship prototype — Done when: one user can complete workflow end-to-end.'
  });

  assert.equal(scored.score, 100);
});
