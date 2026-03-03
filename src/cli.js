import { runAnalyzeCommand } from './commands/analyze.js';
import { runIngestIdeasCommand } from './commands/ingestIdeas.js';
import { runBuildPortfolioCommand } from './commands/buildPortfolio.js';

export async function runCli(argv) {
  const [command] = argv;

  switch (command) {
    case 'analyze':
      await runAnalyzeCommand();
      return;
    case 'ingest-ideas':
      await runIngestIdeasCommand();
      return;
    case 'build-portfolio':
      await runBuildPortfolioCommand();
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
  console.log('Usage: github-portfolio-analyzer <command>');
  console.log('Commands:');
  console.log('  analyze          Analyze GitHub repositories and build inventory outputs');
  console.log('  ingest-ideas     Add or update manual project ideas');
  console.log('  build-portfolio  Merge repos and ideas into the portfolio outputs');
}
