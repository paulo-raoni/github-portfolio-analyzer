import path from 'node:path';
import { buildReportModel } from '../core/report.js';
import { readJsonFile, readJsonFileIfExists } from '../io/files.js';
import { writeReportAscii, writeReportJson, writeReportMarkdown } from '../io/report.js';

const ALLOWED_FORMATS = new Set(['ascii', 'md', 'json', 'all']);

export async function runReportCommand(options = {}) {
  const outputDir = typeof options['output-dir'] === 'string' ? options['output-dir'] : 'output';
  const formatOption = typeof options.format === 'string' ? options.format.toLowerCase() : 'all';

  if (!ALLOWED_FORMATS.has(formatOption)) {
    throw new Error('Invalid --format value. Allowed values: ascii|md|json|all');
  }

  const portfolioPath = path.join(outputDir, 'portfolio.json');
  const inventoryPath = path.join(outputDir, 'inventory.json');

  const portfolio = await readJsonFile(portfolioPath).catch((error) => {
    if (error && error.code === 'ENOENT') {
      throw new Error(`Missing required input: ${portfolioPath}. Run build-portfolio before report.`);
    }

    throw error;
  });

  const inventory = await readJsonFileIfExists(inventoryPath);
  const reportModel = buildReportModel(portfolio, inventory);

  const writtenPaths = [];

  if (formatOption === 'json' || formatOption === 'all') {
    writtenPaths.push(await writeReportJson(outputDir, reportModel));
  }

  if (formatOption === 'md' || formatOption === 'all') {
    writtenPaths.push(await writeReportMarkdown(outputDir, reportModel));
  }

  if (formatOption === 'ascii' || formatOption === 'all') {
    writtenPaths.push(await writeReportAscii(outputDir, reportModel));
  }

  console.log(`Generated portfolio decision report for ${reportModel.meta.counts.total} items.`);
  for (const filePath of writtenPaths) {
    console.log(`Wrote ${filePath}.`);
  }
}
