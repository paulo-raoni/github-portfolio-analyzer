import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRepositoryStructure } from '../src/github/repo-inspection.js';
import { GithubApiError } from '../src/github/client.js';

const repository = { ownerLogin: 'octocat', name: 'hello', hasLicense: true };

function makeClient(map) {
  return {
    async request(path) {
      const key = Object.keys(map).find((entry) => path.includes(entry));

      if (!key) {
        throw new Error(`Unexpected: ${path}`);
      }

      const value = map[key];
      if (value instanceof Error) {
        throw value;
      }

      return value;
    }
  };
}

function notFound() {
  return new GithubApiError('Not Found', { status: 404, data: null, headers: null });
}

function serverError() {
  return new GithubApiError('Server Error', { status: 500, data: null, headers: null });
}

test('detects readme, package.json with test script, and CI', async () => {
  const client = makeClient({
    readme: { name: 'README.md' },
    'contents/package.json': {
      content: Buffer.from(JSON.stringify({ scripts: { test: 'node --test' } })).toString('base64'),
      encoding: 'base64'
    },
    workflows: [{ name: 'ci.yml' }],
    '/contents': []
  });

  const result = await inspectRepositoryStructure(client, repository);
  assert.equal(result.hasReadme, true);
  assert.equal(result.hasPackageJson, true);
  assert.equal(result.hasTests, true);
  assert.equal(result.hasCi, true);
});

test('404 on readme -> hasReadme false, does not throw', async () => {
  const client = makeClient({
    readme: notFound(),
    'contents/package.json': notFound(),
    workflows: notFound(),
    '/contents': []
  });

  const result = await inspectRepositoryStructure(client, repository);
  assert.equal(result.hasReadme, false);
});

test('500 on readme propagates', async () => {
  const client = makeClient({
    readme: serverError(),
    'contents/package.json': notFound(),
    workflows: notFound(),
    '/contents': []
  });

  await assert.rejects(() => inspectRepositoryStructure(client, repository), GithubApiError);
});

test('"no test specified" script -> hasTests false', async () => {
  const client = makeClient({
    readme: { name: 'README.md' },
    'contents/package.json': {
      content: Buffer.from(JSON.stringify({
        scripts: { test: 'echo "Error: no test specified" && exit 1' }
      })).toString('base64'),
      encoding: 'base64'
    },
    workflows: notFound(),
    '/contents': []
  });

  const result = await inspectRepositoryStructure(client, repository);
  assert.equal(result.hasTests, false);
});

test('test directory in root -> hasTests true without package.json', async () => {
  const client = makeClient({
    readme: notFound(),
    'contents/package.json': notFound(),
    workflows: notFound(),
    '/contents': [{ name: 'test' }, { name: 'src' }]
  });

  const result = await inspectRepositoryStructure(client, repository);
  assert.equal(result.hasTests, true);
});

test('__tests__ directory -> hasTests true', async () => {
  const client = makeClient({
    readme: notFound(),
    'contents/package.json': notFound(),
    workflows: notFound(),
    '/contents': [{ name: '__tests__' }]
  });

  const result = await inspectRepositoryStructure(client, repository);
  assert.equal(result.hasTests, true);
});

test('invalid base64 in package.json -> hasPackageJson false, no throw', async () => {
  const client = makeClient({
    readme: notFound(),
    'contents/package.json': { content: '!!!not-valid-base64!!!', encoding: 'base64' },
    workflows: notFound(),
    '/contents': []
  });

  const result = await inspectRepositoryStructure(client, repository);
  assert.equal(result.hasPackageJson, false);
});
