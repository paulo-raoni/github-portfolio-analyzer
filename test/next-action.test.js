import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNextAction, formatNextAction } from '../src/utils/nextAction.js';

test('normalizeNextAction accepts em dash marker', () => {
  const value = 'Ship release notes automation — Done when: draft notes are generated from merged pull requests.';
  const normalized = normalizeNextAction(value);
  assert.equal(normalized, value);
  assert.ok(normalized.includes('— Done when:'));
});

test('normalizeNextAction accepts fallback hyphen marker and rewrites to em dash', () => {
  const value = 'Define MVP scope - Done when: issue includes user stories and acceptance checks.';
  const normalized = normalizeNextAction(value);
  assert.ok(normalized.includes('— Done when:'));
  assert.equal(normalized.includes(' - Done when:'), false);
});

test('normalizeNextAction rejects invalid format with clear error', () => {
  assert.throws(
    () => normalizeNextAction('Define MVP scope and acceptance checks'),
    /Invalid nextAction format\. Required/
  );
});

test('formatNextAction always emits em dash marker', () => {
  const value = formatNextAction('Ship', 'a patch release', 'changelog is published and package is tagged');
  assert.ok(value.includes('— Done when:'));
});
