import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export function getEnv() {
  return {
    githubToken: process.env.GITHUB_TOKEN ?? '',
    githubUsername: process.env.GITHUB_USERNAME ?? ''
  };
}

export function requireGithubToken(env = getEnv()) {
  if (!env.githubToken) {
    throw new Error('Missing GITHUB_TOKEN. Add it to your .env file before running analyze.');
  }

  return env.githubToken;
}
