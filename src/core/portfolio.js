import path from 'node:path';
import { readJsonFileIfExists, writeJsonFile } from '../io/files.js';
import { writePortfolioSummary, writeProjectMarkdownFiles } from '../io/markdown.js';
import { buildRepoTaxonomy, buildIdeaTaxonomy } from './taxonomy.js';
import { slugify } from '../utils/slug.js';
import { utcNowISOString } from '../utils/time.js';

export async function buildPortfolio(options = {}) {
  const outputDir = typeof options['output-dir'] === 'string' ? options['output-dir'] : 'output';
  const inventoryPath = path.join(outputDir, 'inventory.json');
  const ideasPath = path.join(outputDir, 'ideas.json');
  const portfolioPath = path.join(outputDir, 'portfolio.json');

  const inventoryData = await readJsonFileIfExists(inventoryPath);
  const ideasData = await readJsonFileIfExists(ideasPath);

  const repos = Array.isArray(inventoryData?.items)
    ? inventoryData.items.map((item) => hydrateRepoItem(item))
    : [];
  const ideas = Array.isArray(ideasData?.items)
    ? ideasData.items.map((item) => hydrateIdeaItem(item))
    : [];

  const items = [...repos, ...ideas].sort((left, right) => {
    if ((right.score ?? 0) !== (left.score ?? 0)) {
      return (right.score ?? 0) - (left.score ?? 0);
    }

    return left.slug.localeCompare(right.slug);
  });

  const generatedAt = utcNowISOString();
  const asOfDate = inventoryData?.meta?.asOfDate ?? null;

  const payload = {
    meta: {
      generatedAt,
      asOfDate,
      count: items.length
    },
    items
  };

  await writeJsonFile(portfolioPath, payload);
  await writeProjectMarkdownFiles(outputDir, items);
  await writePortfolioSummary(outputDir, {
    generatedAt,
    asOfDate,
    items
  });

  return { portfolioPath, count: items.length };
}

function hydrateRepoItem(item) {
  const slug = slugify(item.slug || item.fullName || item.name || String(item.id));
  const taxonomy = hasTaxonomy(item) ? pickTaxonomy(item) : buildRepoTaxonomy(item);

  return {
    ...item,
    slug,
    ...taxonomy,
    type: 'repo'
  };
}

function hydrateIdeaItem(item) {
  const slug = slugify(item.slug || item.title || String(item.id));
  const taxonomy = hasTaxonomy(item) ? pickTaxonomy(item) : buildIdeaTaxonomy(item);

  return {
    ...item,
    slug,
    ...taxonomy,
    type: 'idea'
  };
}

function hasTaxonomy(item) {
  return Boolean(
    item?.category &&
      item?.state &&
      item?.strategy &&
      item?.effort &&
      item?.value &&
      item?.nextAction &&
      item?.taxonomyMeta
  );
}

function pickTaxonomy(item) {
  return {
    category: item.category,
    state: item.state,
    strategy: item.strategy,
    effort: item.effort,
    value: item.value,
    nextAction: item.nextAction,
    taxonomyMeta: item.taxonomyMeta
  };
}
