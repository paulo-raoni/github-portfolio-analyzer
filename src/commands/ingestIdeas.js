import { ingestIdeas } from '../core/ideas.js';

export async function runIngestIdeasCommand(options = {}) {
  const result = await ingestIdeas(options);
  console.log(`Ingested ${result.count} ideas.`);
  console.log(`Wrote ${result.outputPath}.`);
}
