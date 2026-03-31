import { ingestIdeas } from '../core/ideas.js';
import { info, success } from '../utils/output.js';

export async function runIngestIdeasCommand(options = {}) {
  info('Ingesting ideas...');
  const result = await ingestIdeas(options);
  success(`✓ Ingested ${result.count} ideas → ${result.outputPath}`);
}
