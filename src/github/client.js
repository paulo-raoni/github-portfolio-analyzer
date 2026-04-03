const GITHUB_API_BASE_URL = 'https://api.github.com';
import { computeRetryDelayMs, isRetryableStatus, sleepMs } from '../utils/retry.js';

export class GithubApiError extends Error {
  constructor(message, options) {
    super(message);
    this.name = 'GithubApiError';
    this.status = options.status;
    this.data = options.data;
    this.headers = options.headers;
  }
}

export class GithubClient {
  constructor(token) {
    this.token = token;
    this.maxRetries = 4;
    this._delay = sleepMs;
  }

  async request(path, init = {}) {
    const url = `${GITHUB_API_BASE_URL}${path}`;
    const requestInit = {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'User-Agent': 'github-portfolio-analyzer',
        ...init.headers
      }
    };

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await fetch(url, requestInit);
      const data = await safeJson(response);

      if (response.ok) {
        return data;
      }

      if (attempt < this.maxRetries && isRetryableStatus(response.status)) {
        const delayMs = computeRetryDelayMs({
          responseHeaders: response.headers,
          attempt
        });
        await this._delay(delayMs);
        continue;
      }

      const details = data?.message ? ` (${data.message})` : '';
      throw new GithubApiError(`GitHub API request failed: ${response.status}${details}`, {
        status: response.status,
        data,
        headers: response.headers
      });
    }

    throw new Error('GitHub request retry loop exited unexpectedly.');
  }

  async getAuthenticatedUser() {
    return this.request('/user');
  }
}

async function safeJson(response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}
