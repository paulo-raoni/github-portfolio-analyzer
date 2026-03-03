import { runAnalyzeCommand } from './commands/analyze.js';
import { runIngestIdeasCommand } from './commands/ingestIdeas.js';
import { runBuildPortfolioCommand } from './commands/buildPortfolio.js';
import { parseArgs } from './utils/args.js';

export async function runCli(argv) {
  const { positional, options } = parseArgs(argv);
  const [command] = positional;

  switch (command) {
    case 'analyze':
      await runAnalyzeCommand(options);
      return;
    case 'ingest-ideas':
      await runIngestIdeasCommand(options);
      return;
    case 'build-portfolio':
      await runBuildPortfolioCommand(options);
      return;
    case '--help':
    case '-h':
    default:
      printHelp();
      return;
  }
}

function printHelp() {
  console.log('github-portfolio-analyzer');
  console.log('Usage: github-portfolio-analyzer <command> [options]');
  console.log('Commands:');
  console.log('  analyze          Analyze GitHub repositories and build inventory outputs');
  console.log('  ingest-ideas     Add or update manual project ideas');
  console.log('  build-portfolio  Merge repos and ideas into the portfolio outputs');
  console.log('');
  console.log('Analyze options:');
  console.log('  --as-of YYYY-MM-DD     Snapshot date in UTC (defaults to today UTC)');
  console.log('  --output-dir PATH      Output directory (default: output)');
  console.log('');
  console.log('Ingest ideas options:');
  console.log('  --input PATH           Input JSON file (default: ideas/input.json)');
  console.log('  --prompt               Add ideas interactively');
  console.log('  --output-dir PATH      Output directory (default: output)');
  console.log('');
  console.log('Build portfolio options:');
  console.log('  --output-dir PATH      Output directory (default: output)');
}
