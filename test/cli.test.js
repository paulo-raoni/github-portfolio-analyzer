import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../src/cli.js';
import { UsageError } from '../src/errors.js';

test('strict mode rejects unknown global flags with usage error', async () => {
  await assert.rejects(
    () => runCli(['--strict', '--foo']),
    (error) => {
      assert.equal(error instanceof UsageError, true);
      assert.equal(error.exitCode, 2);
      assert.match(error.message, /Unknown option\(s\): --foo/);
      return true;
    }
  );
});

test('strict mode rejects unknown command flags before execution', async () => {
  await assert.rejects(
    () => runCli(['report', '--strict', '--foo']),
    (error) => {
      assert.equal(error instanceof UsageError, true);
      assert.equal(error.exitCode, 2);
      assert.match(error.message, /Unknown option\(s\): --foo/);
      return true;
    }
  );
});

test('non-strict mode keeps unknown flags permissive', async () => {
  const captured = [];
  const originalLog = console.log;
  console.log = (...args) => {
    captured.push(args.join(' '));
  };

  try {
    await runCli(['--foo']);
  } finally {
    console.log = originalLog;
  }

  assert.equal(captured.some((line) => line.includes('Usage: github-portfolio-analyzer')), true);
});
