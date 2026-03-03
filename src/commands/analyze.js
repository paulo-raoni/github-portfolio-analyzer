import { getEnv, requireGithubToken } from '../config.js';
import { GithubClient } from '../github/client.js';

export async function runAnalyzeCommand() {
  const env = getEnv();
  const token = requireGithubToken(env);
  const github = new GithubClient(token);

  const user = await github.getAuthenticatedUser();
  console.log(`Authenticated as ${user.login}.`);
  console.log('Analyze skeleton ready. Repository inventory will be implemented in the next milestone.');
}
