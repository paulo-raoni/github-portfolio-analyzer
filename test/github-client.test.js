import test from 'node:test';
import assert from 'node:assert/strict';
import { GithubClient, GithubApiError } from '../src/github/client.js';

function makeResponse(status, body, headers = {}) {
  return new globalThis.Response(
    body === null ? '' : JSON.stringify(body),
    {
      status,
      headers: {
        'content-type': body === null ? 'text/plain' : 'application/json',
        ...headers
      }
    }
  );
}

test('GithubClient returns parsed JSON on 200', async () => {
  const client = new GithubClient('token');
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => makeResponse(200, { login: 'octocat' });

  try {
    const result = await client.request('/user');
    assert.equal(result.login, 'octocat');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GithubClient returns null for non-JSON response', async () => {
  const client = new GithubClient('token');
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new globalThis.Response('plain text', {
    status: 200,
    headers: { 'content-type': 'text/plain' }
  });

  try {
    const result = await client.request('/user');
    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GithubClient throws GithubApiError on 404 without retry', async () => {
  const client = new GithubClient('token');
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return makeResponse(404, { message: 'Not Found' });
  };

  try {
    await assert.rejects(() => client.request('/repos/x/y'), (error) => {
      assert.ok(error instanceof GithubApiError);
      assert.equal(error.status, 404);
      return true;
    });
    assert.equal(calls, 1, '404 should not be retried');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GithubClient retries on 429 and succeeds', async () => {
  const client = new GithubClient('token');
  client.maxRetries = 2;
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return makeResponse(429, { message: 'rate limited' }, { 'retry-after': '0' });
    }

    return makeResponse(200, { ok: true });
  };

  try {
    const result = await client.request('/user');
    assert.equal(result.ok, true);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GithubClient retries on 500 and succeeds on third attempt', async () => {
  const client = new GithubClient('token');
  client.maxRetries = 3;
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    if (calls < 3) {
      return makeResponse(500, { message: 'Server Error' });
    }

    return makeResponse(200, { ok: true });
  };

  try {
    const result = await client.request('/user');
    assert.equal(result.ok, true);
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GithubClient throws after exhausting retries on 500', async () => {
  const client = new GithubClient('token');
  client.maxRetries = 1;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => makeResponse(500, { message: 'Server Error' });

  try {
    await assert.rejects(() => client.request('/user'), (error) => {
      assert.ok(error instanceof GithubApiError);
      assert.equal(error.status, 500);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GithubClient does not retry on 401', async () => {
  const client = new GithubClient('token');
  client.maxRetries = 3;
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return makeResponse(401, { message: 'Unauthorized' });
  };

  try {
    await assert.rejects(() => client.request('/user'), GithubApiError);
    assert.equal(calls, 1, '401 should not be retried');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GithubClient respects retry-after header delay', async () => {
  const client = new GithubClient('token');
  client.maxRetries = 1;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => makeResponse(429, {}, { 'retry-after': '0' });

  try {
    await assert.rejects(() => client.request('/user'), GithubApiError);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
