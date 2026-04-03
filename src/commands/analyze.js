import path from 'node:path';
import { promptMissingKeys, requireGithubToken } from '../config.js';
import { GithubClient } from '../github/client.js';
import { fetchAllRepositories, normalizeRepository } from '../github/repos.js';
import { inspectRepositoryStructure } from '../github/repo-inspection.js';
import { classifyActivity, classifyMaturity } from '../core/classification.js';
import { scoreRepository } from '../core/scoring.js';
import { buildRepoTaxonomy } from '../core/taxonomy.js';
import { writeJsonFile } from '../io/files.js';
import { writeInventoryCsv } from '../io/csv.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { resolveAsOfDate, utcNowISOString } from '../utils/time.js';
import { printHeader } from '../utils/header.js';
import { progress, success, error, warn, fatal } from '../utils/output.js';

export async function runAnalyzeCommand(options = {}) {
  const startTime = Date.now();
  let args = { ...options };

  args = await promptMissingKeys(args, {
    quiet: args.quiet,
    required: [
      { key: 'githubToken', label: 'GitHub Personal Access Token' }
    ],
    optional: [
      { key: 'githubUsername', label: 'GitHub Username' },
      { key: 'openaiKey', label: 'OpenAI API Key' },
      { key: 'geminiKey', label: 'Gemini API Key' },
      { key: 'anthropicKey', label: 'Anthropic API Key' }
    ]
  });

  let token;
  try {
    token = requireGithubToken(args);
  } catch (err) {
    fatal('GITHUB_TOKEN missing — set it in .env or pass --github-token');
    throw err;
  }

  const github = new GithubClient(token);
  const asOfDate = resolveAsOfDate(typeof args['as-of'] === 'string' ? args['as-of'] : undefined);
  const outputDir = typeof args['output-dir'] === 'string' ? args['output-dir'] : 'output';

  let user;
  try {
    user = await github.getAuthenticatedUser();
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      fatal('GitHub authentication failed — check your GITHUB_TOKEN permissions');
    } else if (err && err.status === 429) {
      fatal('GitHub API rate limit exceeded — wait or use a different token');
    }
    throw err;
  }

  printHeader({
    command: 'analyze',
    asOfDate,
    outputDir,
    hasToken: Boolean(token),
    hasPolicy: false,
    username: args.githubUsername || user.login
  });

  let repositories;
  try {
    repositories = await fetchAllRepositories(github);
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      fatal('GitHub authentication failed — check your GITHUB_TOKEN permissions');
    } else if (err && err.status === 429) {
      fatal('GitHub API rate limit exceeded — wait or use a different token');
    }
    throw err;
  }

  let analyzed = 0;
  let fallbacks = 0;

  const items = await mapWithConcurrency(repositories, 5, async (repo) => {
    analyzed++;
    const index = String(analyzed).padStart(String(repositories.length).length, ' ');
    const normalized = normalizeRepository(repo);
    try {
      progress(`Analyzing ${index}/${repositories.length}: ${repo.name}`);
      const structuralHealth = await inspectRepositoryStructure(github, normalized);
      const activity = classifyActivity(normalized._pushedAt, asOfDate);
      const maturity = classifyMaturity(normalized.sizeKb);
      const taxonomy = buildRepoTaxonomy({
        ...normalized,
        structuralHealth,
        activity,
        maturity
      });
      const { score, scoreBreakdown } = scoreRepository(
        {
          ...normalized,
          structuralHealth,
          pushedAt: normalized._pushedAt,
          updatedAt: normalized._updatedAt,
          category: taxonomy.category
        },
        asOfDate
      );

      return stripInternalFields({
        ...normalized,
        structuralHealth,
        activity,
        maturity,
        score,
        scoreBreakdown,
        ...taxonomy
      });
    } catch (err) {
      fallbacks++;
      error(`✗ Analyzing ${index}/${repositories.length}: ${repo.name} — structural analysis failed, using fallback`);
      const activity = classifyActivity(normalized._pushedAt, asOfDate);
      const maturity = classifyMaturity(normalized.sizeKb);
      const fallbackStructuralHealth = {
        hasReadme: false,
        hasLicense: Boolean(normalized.hasLicense),
        hasPackageJson: false,
        hasTests: false,
        hasCi: false
      };
      const taxonomy = buildRepoTaxonomy({
        ...normalized,
        structuralHealth: fallbackStructuralHealth,
        activity,
        maturity
      });
      const { score, scoreBreakdown } = scoreRepository(
        {
          ...normalized,
          structuralHealth: fallbackStructuralHealth,
          pushedAt: normalized._pushedAt,
          updatedAt: normalized._updatedAt,
          category: taxonomy.category
        },
        asOfDate
      );

      return stripInternalFields({
        ...normalized,
        structuralHealth: fallbackStructuralHealth,
        activity,
        maturity,
        score,
        scoreBreakdown,
        ...taxonomy,
        analysisErrors: [`Structural analysis failed: ${err.message}`]
      });
    }
  });

  items.sort((left, right) => left.fullName.localeCompare(right.fullName));

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
  const inventoryCsvPath = await writeInventoryCsv(outputDir, items);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (fallbacks > 0) {
    warn(`${fallbacks} repo(s) used fallback scoring — structural inspection failed`);
  }
  success(`✓ Analyzed ${repositories.length} repositories (${repositories.length - fallbacks} ok${fallbacks > 0 ? `, ${fallbacks} fallback` : ''}) in ${elapsed}s`);
  success(`✓ Wrote ${inventoryPath}`);
  success(`✓ Wrote ${inventoryCsvPath}`);
}

function stripInternalFields(item) {
  const output = {};
  for (const [key, value] of Object.entries(item)) {
    if (!key.startsWith('_')) {
      output[key] = value;
    }
  }
  return output;
}
