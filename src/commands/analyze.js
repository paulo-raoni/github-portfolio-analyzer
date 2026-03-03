import path from 'node:path';
import { getEnv, requireGithubToken } from '../config.js';
import { GithubClient } from '../github/client.js';
import { fetchAllRepositories, normalizeRepository } from '../github/repos.js';
import { writeJsonFile } from '../io/files.js';
import { resolveAsOfDate, utcNowISOString } from '../utils/time.js';

export async function runAnalyzeCommand(options = {}) {
  const env = getEnv();
  const token = requireGithubToken(env);
  const github = new GithubClient(token);
  const asOfDate = resolveAsOfDate(typeof options['as-of'] === 'string' ? options['as-of'] : undefined);

  const user = await github.getAuthenticatedUser();
  const repositories = await fetchAllRepositories(github);
  const items = repositories.map(normalizeRepository);

  const outputDir = typeof options['output-dir'] === 'string' ? options['output-dir'] : 'output';
  const inventoryPath = path.join(outputDir, 'inventory.json');

  await writeJsonFile(inventoryPath, {
    meta: {
      generatedAt: utcNowISOString(),
      asOfDate,
      owner: user.login,
      count: items.length
    },
    items
  });

  console.log(`Analyzed ${items.length} repositories for ${user.login}.`);
  console.log(`Wrote ${inventoryPath}.`);
}
