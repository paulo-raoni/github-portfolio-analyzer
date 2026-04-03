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
  rl.stdoutMuted = false;

  const askVisible = (label, hint) =>
    new Promise((resolve) => {
      rl.question(`  ${label}${hint ? ` (${hint})` : ''}: `, resolve);
    });

  const askSilent = (label, hint) =>
    new Promise((resolve) => {
      const originalWriteToOutput = rl._writeToOutput;
      rl.stdoutMuted = true;
      rl._writeToOutput = (str) => {
        if (rl.stdoutMuted) {
          rl.output.write('');
          return;
        }

        rl.output.write(str);
      };

      rl.question(`  ${label}${hint ? ` (${hint})` : ''}: `, (value) => {
        rl.stdoutMuted = false;
        rl._writeToOutput = originalWriteToOutput;
        rl.output.write('\n');
        resolve(value);
      });
    });

  for (const { key, label } of required) {
    if (env[key]) {
      continue;
    }

    const value = await askSilent(label, 'required');
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

    const prompt = key === 'githubUsername' ? askVisible : askSilent;
    const value = await prompt(label, 'optional, Enter to skip');
    if (value.trim()) {
      result[key] = value.trim();
    }
  }

  rl.close();
  return result;
}
