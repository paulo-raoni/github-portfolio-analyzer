const PAGE_SIZE = 100;

export async function fetchAllRepositories(client) {
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
  return repositories;
}

export function normalizeRepository(repo) {
  return {
    id: repo.id,
    nodeId: repo.node_id,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    archived: repo.archived,
    fork: repo.fork,
    htmlUrl: repo.html_url,
    description: repo.description,
    language: repo.language,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    openIssuesCount: repo.open_issues_count,
    sizeKb: repo.size,
    defaultBranch: repo.default_branch,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    hasLicense: Boolean(repo.license),
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at
  };
}
