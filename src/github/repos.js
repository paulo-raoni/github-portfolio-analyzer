const PAGE_SIZE = 100;

/**
 * Classifies a fork as active or passive.
 * Active forks are ahead of the upstream default branch.
 */
export async function classifyFork(client, repo, asOfDate = new Date().toISOString().slice(0, 10)) {
  if (!repo?.fork) {
    return null;
  }

  const parent = repo.parent;
  const fallbackForkType = 'passive';

  if (!parent) {
    return fallbackForkType;
  }

  const ownerLogin = repo.owner?.login ?? repo.ownerLogin;
  const parentOwner = parent.owner?.login;
  const parentBranch = parent.default_branch ?? parent.defaultBranch ?? 'main';
  const branch = repo.default_branch ?? repo.defaultBranch ?? 'main';

  if (!ownerLogin || !parentOwner || !repo.name) {
    return fallbackForkType;
  }

  try {
    const comparison = await client.request(
      `/repos/${encodeURIComponent(ownerLogin)}/${encodeURIComponent(repo.name)}/compare/${encodeURIComponent(parentOwner)}:${encodeURIComponent(parentBranch)}...${encodeURIComponent(ownerLogin)}:${encodeURIComponent(branch)}`
    );

    return (comparison?.ahead_by ?? 0) > 0 ? 'active' : 'passive';
  } catch {
    return fallbackForkType;
  }
}

export async function fetchAllRepositories(client, asOfDate = new Date().toISOString().slice(0, 10)) {
  const repositories = [];

  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({
      per_page: String(PAGE_SIZE),
      page: String(page),
      sort: 'full_name',
      direction: 'asc',
      visibility: 'all'
    });

    const pageItems = await client.request(`/user/repos?${params.toString()}`);

    if (!Array.isArray(pageItems) || pageItems.length === 0) {
      break;
    }

    repositories.push(...pageItems);

    if (pageItems.length < PAGE_SIZE) {
      break;
    }
  }

  repositories.sort((left, right) => left.full_name.localeCompare(right.full_name));

  const forks = repositories.filter((repository) => repository.fork);
  for (let index = 0; index < forks.length; index += 5) {
    const batch = forks.slice(index, index + 5);
    await Promise.all(
      batch.map(async (repository) => {
        repository.forkType = await classifyFork(client, repository, asOfDate);
      })
    );
  }

  for (let index = 0; index < repositories.length; index += 5) {
    const batch = repositories.slice(index, index + 5);
    await Promise.all(
      batch.map(async (repository) => {
        const ownerLogin = repository.owner?.login ?? repository.ownerLogin ?? '';
        if (!ownerLogin || !repository.name) {
          repository.languages = {};
          return;
        }

        try {
          repository.languages = await client.request(
            `/repos/${encodeURIComponent(ownerLogin)}/${encodeURIComponent(repository.name)}/languages`
          );
        } catch {
          repository.languages = {};
        }
      })
    );
  }

  return repositories;
}

export function normalizeRepository(repo) {
  return {
    id: repo.id,
    nodeId: repo.node_id,
    name: repo.name,
    ownerLogin: repo.owner?.login ?? repo.ownerLogin ?? '',
    fullName: repo.full_name,
    private: Boolean(repo.private),
    archived: repo.archived,
    fork: repo.fork,
    forkType: repo.forkType ?? null,
    parent: repo.parent ?? null,
    htmlUrl: repo.html_url,
    description: repo.description,
    language: repo.language,
    languages:
      typeof repo.languages === 'object' && repo.languages !== null && !Array.isArray(repo.languages)
        ? repo.languages
        : {},
    homepage: typeof repo.homepage === 'string' && repo.homepage.trim().length > 0
      ? repo.homepage.trim()
      : null,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    openIssuesCount: repo.open_issues_count,
    sizeKb: repo.size,
    defaultBranch: repo.default_branch,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    hasLicense: Boolean(repo.license),
    _updatedAt: repo.updated_at,
    _pushedAt: repo.pushed_at
  };
}
