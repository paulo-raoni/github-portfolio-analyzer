import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFork, normalizeRepository } from '../src/github/repos.js';

test('classifyFork returns active when fork is ahead of upstream', async () => {
  const requestedPaths = [];
  const client = {
    async request(path) {
      requestedPaths.push(path);
      return { ahead_by: 2 };
    }
  };

  const forkType = await classifyFork(client, {
    fork: true,
    name: 'my-fork',
    owner: { login: 'owner' },
    default_branch: 'main',
    parent: {
      owner: { login: 'upstream' },
      default_branch: 'main'
    }
  });

  assert.equal(forkType, 'active');
  assert.equal(
    requestedPaths[0],
    '/repos/owner/my-fork/compare/upstream:main...owner:main'
  );
});

test('classifyFork falls back to passive when comparison API throws, regardless of pushed_at', async () => {
  const client = {
    async request() {
      throw new Error('comparison failed');
    }
  };

  assert.equal(
    await classifyFork(client, {
      fork: true,
      name: 'my-fork',
      owner: { login: 'owner' },
      pushed_at: '2026-03-20T00:00:00.000Z',
      parent: {
        owner: { login: 'upstream' },
        default_branch: 'main'
      }
    }, '2026-04-03'),
    'passive'
  );
});

test('classifyFork falls back to passive when compare is unavailable and parent metadata is missing', async () => {
  const client = {
    async request() {
      throw new Error('comparison failed');
    }
  };

  assert.equal(
    await classifyFork(client, {
      fork: true,
      name: 'my-fork',
      owner: { login: 'owner' },
      pushed_at: '2025-10-01T00:00:00.000Z',
      parent: null
    }, '2026-04-03'),
    'passive'
  );
});

test('normalizeRepository preserves fork metadata for downstream consumers', () => {
  const normalized = normalizeRepository({
    id: 1,
    node_id: 'node',
    name: 'my-repo',
    owner: { login: 'owner' },
    full_name: 'owner/my-repo',
    private: true,
    archived: false,
    fork: true,
    forkType: 'passive',
    parent: { full_name: 'upstream/my-repo' },
    html_url: 'https://github.com/owner/my-repo',
    description: 'desc',
    language: 'TypeScript',
    homepage: '',
    stargazers_count: 1,
    forks_count: 2,
    open_issues_count: 0,
    size: 10,
    default_branch: 'main',
    topics: ['cli'],
    license: { key: 'mit' },
    updated_at: '2026-03-03T00:00:00.000Z',
    pushed_at: '2026-03-03T00:00:00.000Z'
  });

  assert.equal(normalized.fork, true);
  assert.equal(normalized.forkType, 'passive');
  assert.deepEqual(normalized.parent, { full_name: 'upstream/my-repo' });
});
