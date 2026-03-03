const GITHUB_API_BASE_URL = 'https://api.github.com';

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
  }

  async request(path, init = {}) {
    const url = `${GITHUB_API_BASE_URL}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'User-Agent': 'github-portfolio-analyzer',
        ...init.headers
      }
    });

    const data = await safeJson(response);

    if (!response.ok) {
      const details = data?.message ? ` (${data.message})` : '';
      throw new GithubApiError(`GitHub API request failed: ${response.status}${details}`, {
        status: response.status,
        data,
        headers: response.headers
      });
    }

    return data;
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
