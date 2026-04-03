import { runAnalyzeCommand } from './commands/analyze.js';
import { runIngestIdeasCommand } from './commands/ingestIdeas.js';
import { runBuildPortfolioCommand } from './commands/buildPortfolio.js';
import { runReportCommand } from './commands/report.js';
import { parseArgs } from './utils/args.js';
import packageJson from '../package.json' with { type: 'json' };
import { UsageError } from './errors.js';

const GLOBAL_OPTIONS = new Set([
  'help',
  'strict',
  'version',
  'github-token',
  'github-username',
  'openai-key',
  'gemini-key',
  'anthropic-key'
]);
const COMMAND_OPTIONS = {
  analyze: new Set(['as-of', 'output-dir']),
  'ingest-ideas': new Set(['input', 'prompt', 'output-dir']),
  'build-portfolio': new Set(['output-dir']),
  report: new Set(['output-dir', 'output', 'format', 'policy', 'priorities', 'explain', 'quiet', 'presentation-overrides'])
};

export async function runCli(argv) {
  const { positional, options: rawOptions } = parseArgs(argv);
  const [command] = positional;
  const strictMode = rawOptions.strict === true || rawOptions.strict === 'true';

  if (strictMode) {
    validateStrictOptions(command, rawOptions);
  }

  const options = mapCredentialOptions(rawOptions);

  if ((options.version === true && !command) || (command === '-v' && positional.length === 1)) {
    console.log(packageJson.version);
    return;
  }

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
    case 'report':
      await runReportCommand(options);
      return;
    case '-v':
      console.log(packageJson.version);
      return;
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      return;
    default:
      throw new UsageError(`Invalid command: ${command}`);
  }
}

function printHelp() {
  console.log('github-portfolio-analyzer');
  console.log('Usage: github-portfolio-analyzer <command> [options]');
  console.log('  --strict               Global: fail on unknown flags (exit code 2)');
  console.log('  --github-token TOKEN   Global: override GITHUB_TOKEN');
  console.log('  --github-username USER Global: override GITHUB_USERNAME');
  console.log('  --openai-key KEY       Global: override OPENAI_API_KEY');
  console.log('  --gemini-key KEY       Global: override GEMINI_API_KEY');
  console.log('  --anthropic-key KEY    Global: override ANTHROPIC_API_KEY');
  console.log('Commands:');
  console.log('  analyze          Analyze GitHub repositories and build inventory outputs');
  console.log('  ingest-ideas     Add or update manual project ideas');
  console.log('  build-portfolio  Merge repos and ideas into the portfolio outputs');
  console.log('  report           Generate decision-oriented portfolio reports');
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
  console.log('');
  console.log('Report options:');
  console.log('  --output-dir PATH      Output directory (default: output)');
  console.log('  --format VALUE         ascii|md|json|all (default: all)');
  console.log('  --policy PATH          Optional policy overlay JSON file');
  console.log('  --priorities PATH      Alias for --policy');
  console.log('  --presentation-overrides PATH');
  console.log('                         Optional presentation overrides JSON file');
  console.log('  --explain              Print NOW ranking explainability to console');
  console.log('  --quiet                Suppress non-error logs');
}

function validateStrictOptions(command, options) {
  const allowedOptions = new Set(GLOBAL_OPTIONS);
  const commandOptions = COMMAND_OPTIONS[command];

  if (commandOptions) {
    for (const key of commandOptions) {
      allowedOptions.add(key);
    }
  }

  const unknown = Object.keys(options).filter((key) => !allowedOptions.has(key));
  if (unknown.length > 0) {
    const unknownFlags = unknown.map((key) => `--${key}`).join(', ');
    throw new UsageError(`Unknown option(s): ${unknownFlags}`);
  }
}

function mapCredentialOptions(options) {
  return {
    ...options,
    ...(options['github-token'] !== undefined ? { githubToken: options['github-token'] } : {}),
    ...(options['github-username'] !== undefined ? { githubUsername: options['github-username'] } : {}),
    ...(options['openai-key'] !== undefined ? { openaiKey: options['openai-key'] } : {}),
    ...(options['gemini-key'] !== undefined ? { geminiKey: options['gemini-key'] } : {}),
    ...(options['anthropic-key'] !== undefined ? { anthropicKey: options['anthropic-key'] } : {})
  };
}
