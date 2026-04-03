import dotenv from 'dotenv';
import { createInterface } from 'node:readline';

dotenv.config({ quiet: true });

/**
 * Returns env vars with optional CLI overrides.
 * args uses camelCase keys, for example { githubToken: '...' }.
 */
export function getEnv(args = {}) {
  return {
    githubToken: args.githubToken ?? process.env.GITHUB_TOKEN ?? '',
    githubUsername: args.githubUsername ?? process.env.GITHUB_USERNAME ?? '',
    openaiKey: args.openaiKey ?? process.env.OPENAI_API_KEY ?? '',
    geminiKey: args.geminiKey ?? process.env.GEMINI_API_KEY ?? '',
    anthropicKey: args.anthropicKey ?? process.env.ANTHROPIC_API_KEY ?? ''
  };
}

export function requireGithubToken(args = {}) {
  const env = getEnv(args);

  if (!env.githubToken) {
    throw new Error(
      'Missing GITHUB_TOKEN. Add it to your .env file or pass --github-token <token>'
    );
  }

  return env.githubToken;
}

/**
 * Interactive terminal prompt for missing keys.
 * Only runs on TTY and when quiet !== true.
 */
export async function promptMissingKeys(
  args = {},
  { required = [], optional = [], quiet = false } = {}
) {
  if (quiet || !process.stdin.isTTY) {
    return args;
  }

  const env = getEnv(args);
  const result = { ...args };
  const rl = createInterface({ input: process.stdin, output: process.stderr });

  const ask = (label, hint) =>
    new Promise((resolve) => {
      rl.question(`  ${label}${hint ? ` (${hint})` : ''}: `, resolve);
    });

  for (const { key, label } of required) {
    if (env[key]) {
      continue;
    }

    const value = await ask(label, 'required');
    if (!value.trim()) {
      rl.close();
      throw new Error(`${label} is required.`);
    }

    result[key] = value.trim();
  }

  for (const { key, label } of optional) {
    if (env[key]) {
      continue;
    }

    const value = await ask(label, 'optional, Enter to skip');
    if (value.trim()) {
      result[key] = value.trim();
    }
  }

  rl.close();
  return result;
}
