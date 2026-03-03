const GITHUB_API_BASE_URL = 'https://api.github.com';

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

    if (!response.ok) {
      const body = await safeJson(response);
      const details = body?.message ? ` (${body.message})` : '';
      throw new Error(`GitHub API request failed: ${response.status}${details}`);
    }

    return safeJson(response);
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
