import { GithubApiError } from './client.js';

export async function inspectRepositoryStructure(client, repository) {
  const [hasReadme, packageJsonContent, rootContents, workflowContents] = await Promise.all([
    checkReadme(client, repository),
    readPackageJson(client, repository),
    readDirectory(client, repository, ''),
    readDirectory(client, repository, '.github/workflows')
  ]);

  const hasPackageJson = packageJsonContent !== null;
  const hasTests = detectTests(packageJsonContent, rootContents);
  const hasCi = Array.isArray(workflowContents) && workflowContents.length > 0;

  return {
    hasReadme,
    hasLicense: Boolean(repository.hasLicense),
    hasPackageJson,
    hasTests,
    hasCi
  };
}

async function checkReadme(client, repository) {
  try {
    await client.request(repoApiPath(repository, 'readme'));
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }
    throw error;
  }
}

async function readPackageJson(client, repository) {
  try {
    const response = await client.request(repoApiPath(repository, 'contents/package.json'));
    if (response?.content && response?.encoding === 'base64') {
      const decoded = Buffer.from(response.content, 'base64').toString('utf8');
      return JSON.parse(decoded);
    }
    return null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

async function readDirectory(client, repository, directoryPath) {
  const suffix = directoryPath.length > 0 ? `contents/${directoryPath}` : 'contents';

  try {
    const response = await client.request(repoApiPath(repository, suffix));
    return Array.isArray(response) ? response : [];
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
}

function detectTests(packageJson, rootContents) {
  const scripts = packageJson?.scripts;
  if (scripts && typeof scripts.test === 'string') {
    const normalized = scripts.test.trim().toLowerCase();
    if (normalized.length > 0 && !normalized.includes('no test specified')) {
      return true;
    }
  }

  const rootNames = new Set((rootContents ?? []).map((entry) => String(entry.name).toLowerCase()));
  const commonTestPaths = ['test', 'tests', '__tests__', 'spec', 'specs'];

  return commonTestPaths.some((name) => rootNames.has(name));
}

function repoApiPath(repository, suffix) {
  return `/repos/${encodeURIComponent(repository.ownerLogin)}/${encodeURIComponent(repository.name)}/${suffix}`;
}

function isNotFound(error) {
  return error instanceof GithubApiError && error.status === 404;
}
