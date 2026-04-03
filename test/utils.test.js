import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/utils/args.js';
import { slugify } from '../src/utils/slug.js';
import { mapWithConcurrency } from '../src/utils/concurrency.js';
import { resolveAsOfDate } from '../src/utils/time.js';

test('parseArgs: --foo=bar inline value', () => {
  assert.equal(parseArgs(['--foo=bar']).options.foo, 'bar');
});

test('parseArgs: boolean flag', () => {
  assert.equal(parseArgs(['--quiet']).options.quiet, true);
});

test('parseArgs: flag followed by another flag is boolean', () => {
  const { options } = parseArgs(['--quiet', '--strict']);
  assert.equal(options.quiet, true);
  assert.equal(options.strict, true);
});

test('parseArgs: positional + flag', () => {
  const { positional, options } = parseArgs(['analyze', '--as-of', '2026-01-01']);
  assert.deepEqual(positional, ['analyze']);
  assert.equal(options['as-of'], '2026-01-01');
});

test('parseArgs: empty argv', () => {
  const { positional, options } = parseArgs([]);
  assert.deepEqual(positional, []);
  assert.deepEqual(options, {});
});

test('slugify: basic string', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
});

test('slugify: special characters stripped', () => {
  assert.equal(slugify('foo/bar.baz'), 'foobarbaz');
});

test('slugify: multiple dashes collapsed', () => {
  assert.equal(slugify('foo--bar---baz'), 'foo-bar-baz');
});

test('slugify: null returns empty string', () => {
  assert.equal(slugify(null), '');
});

test('slugify: already-valid slug unchanged', () => {
  assert.equal(slugify('my-project-123'), 'my-project-123');
});

test('mapWithConcurrency: preserves order', async () => {
  const results = await mapWithConcurrency([3, 1, 2], 3, async (value) => {
    await new Promise((resolve) => setTimeout(resolve, value * 5));
    return value * 2;
  });

  assert.deepEqual(results, [6, 2, 4]);
});

test('mapWithConcurrency: propagates error', async () => {
  await assert.rejects(
    () => mapWithConcurrency([1, 2, 3], 2, async (value) => {
      if (value === 2) {
        throw new Error('fail at 2');
      }

      return value;
    }),
    /fail at 2/
  );
});

test('mapWithConcurrency: empty array', async () => {
  assert.deepEqual(await mapWithConcurrency([], 5, async (value) => value), []);
});

test('mapWithConcurrency: non-array input returns empty', async () => {
  assert.deepEqual(await mapWithConcurrency(null, 5, async (value) => value), []);
});

test('resolveAsOfDate: valid date string returned as-is', () => {
  assert.equal(resolveAsOfDate('2026-01-15'), '2026-01-15');
});

test('resolveAsOfDate: undefined returns today UTC', () => {
  assert.match(resolveAsOfDate(undefined), /^\d{4}-\d{2}-\d{2}$/);
});

test('resolveAsOfDate: invalid string throws', () => {
  assert.throws(
    () => resolveAsOfDate('not-a-date'),
    /Invalid --as-of value/
  );
});

test('resolveAsOfDate: calendar overflow throws', () => {
  assert.throws(
    () => resolveAsOfDate('2026-02-31'),
    /Invalid --as-of value/
  );
});
