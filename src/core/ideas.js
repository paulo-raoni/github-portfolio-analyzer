import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readJsonFileIfExists, writeJsonFile } from '../io/files.js';
import { scoreIdea } from './scoring.js';
import { buildIdeaTaxonomy } from './taxonomy.js';
import { normalizeNextAction } from '../utils/nextAction.js';
import { slugify } from '../utils/slug.js';
import { utcNowISOString } from '../utils/time.js';

export async function ingestIdeas(options = {}) {
  const outputDir = typeof options['output-dir'] === 'string' ? options['output-dir'] : 'output';
  const inputPath = typeof options.input === 'string' ? options.input : path.join('ideas', 'input.json');
  const shouldPrompt = options.prompt === true;

  const existingIdeas = await loadExistingIdeas(path.join(outputDir, 'ideas.json'));
  const fromFile = await loadIdeasFromFile(inputPath);
  const fromPrompt = shouldPrompt ? await promptIdeas() : [];
  const incomingIdeas = [...fromFile, ...fromPrompt];

  if (incomingIdeas.length === 0 && existingIdeas.length === 0) {
    throw new Error(`No ideas to ingest. Add entries to ${inputPath} or use --prompt.`);
  }

  const merged = new Map(existingIdeas.map((item) => [item.slug, item]));

  for (const rawIdea of incomingIdeas) {
    const normalized = normalizeIdea(rawIdea);
    const taxonomy = buildIdeaTaxonomy(normalized);
    const scored = scoreIdea({
      ...normalized,
      nextAction: taxonomy.nextAction
    });

    const item = {
      ...normalized,
      ...taxonomy,
      score: scored.score,
      scoreBreakdown: scored.scoreBreakdown
    };

    merged.set(item.slug, item);
  }

  const items = Array.from(merged.values()).sort((left, right) => left.slug.localeCompare(right.slug));
  const outputPath = path.join(outputDir, 'ideas.json');

  await writeJsonFile(outputPath, {
    meta: {
      generatedAt: utcNowISOString(),
      count: items.length
    },
    items
  });

  return { outputPath, count: items.length };
}

async function loadExistingIdeas(filePath) {
  const value = await readJsonFileIfExists(filePath);
  if (!value || !Array.isArray(value.items)) {
    return [];
  }

  return value.items;
}

async function loadIdeasFromFile(filePath) {
  const value = await readJsonFileIfExists(filePath);
  if (!value) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Ideas input must be a JSON array: ${filePath}`);
  }

  return value;
}

function normalizeIdea(inputIdea) {
  const title = String(inputIdea?.title ?? '').trim();
  if (!title) {
    throw new Error('Each idea must include a non-empty title.');
  }

  const slug = slugify(inputIdea.slug || title);
  if (!slug) {
    throw new Error(`Unable to derive slug for idea title: ${title}`);
  }

  const nextActionRaw = typeof inputIdea.nextAction === 'string' ? inputIdea.nextAction : '';

  return {
    id: `idea:${slug}`,
    slug,
    title,
    description: textOrNull(inputIdea.description),
    problem: textOrNull(inputIdea.problem),
    scope: textOrNull(inputIdea.scope),
    targetUser: textOrNull(inputIdea.targetUser),
    mvp: textOrNull(inputIdea.mvp),
    status: textOrDefault(inputIdea.status, 'draft'),
    tags: normalizeTags(inputIdea.tags),
    category: textOrNull(inputIdea.category),
    state: textOrNull(inputIdea.state),
    strategy: textOrNull(inputIdea.strategy),
    effort: textOrNull(inputIdea.effort),
    value: textOrNull(inputIdea.value),
    ...(nextActionRaw.trim().length > 0 ? { nextAction: normalizeNextAction(nextActionRaw) } : {})
  };
}

async function promptIdeas() {
  const rl = readline.createInterface({ input, output });
  const results = [];

  try {
    while (true) {
      const title = (await rl.question('Idea title (leave empty to finish): ')).trim();
      if (!title) {
        break;
      }

      const problem = (await rl.question('Problem: ')).trim();
      const scope = (await rl.question('Scope: ')).trim();
      const targetUser = (await rl.question('Target user: ')).trim();
      const mvp = (await rl.question('MVP: ')).trim();
      const nextAction = (await rl.question('Next action (<Verb> <target> — Done when: <measurable condition>): ')).trim();

      results.push({
        title,
        problem,
        scope,
        targetUser,
        mvp,
        nextAction: nextAction || undefined
      });
    }
  } finally {
    rl.close();
  }

  return results;
}

function textOrNull(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function textOrDefault(value, defaultValue) {
  const normalized = textOrNull(value);
  return normalized ?? defaultValue;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => item.length > 0)
    .sort((left, right) => left.localeCompare(right));
}
