import path from 'node:path';
import { buildReportModel } from '../core/report.js';
import { loadPresentationOverrides, applyPresentationOverrides } from '../core/presentationOverrides.js';
import { readJsonFile, readJsonFileIfExists } from '../io/files.js';
import { writeReportAscii, writeReportJson, writeReportMarkdown } from '../io/report.js';
import { UsageError } from '../errors.js';
import { printHeader } from '../utils/header.js';
import { success } from '../utils/output.js';

const ALLOWED_FORMATS = new Set(['ascii', 'md', 'json', 'all']);

export async function runReportCommand(options = {}) {
  const inputDir = typeof options['output-dir'] === 'string' ? options['output-dir'] : 'output';
  const outputDir = typeof options.output === 'string' ? options.output : inputDir;
  const formatOption = typeof options.format === 'string' ? options.format.toLowerCase() : 'all';
  const policyPath = resolvePolicyPath(options);
  const explain = options.explain === true;
  const quiet = options.quiet === true || options.quiet === 'true';

  if (!quiet) {
    printHeader({
      command: 'report',
      outputDir,
      hasToken: false,
      hasPolicy: Boolean(policyPath),
    });
  }

  if (!ALLOWED_FORMATS.has(formatOption)) {
    throw new UsageError('Invalid --format value. Allowed values: ascii|md|json|all');
  }

  const portfolioPath = path.join(inputDir, 'portfolio.json');
  const inventoryPath = path.join(inputDir, 'inventory.json');

  const portfolio = await readJsonFile(portfolioPath).catch((error) => {
    if (error && error.code === 'ENOENT') {
      throw new Error(`Missing required input: ${portfolioPath}. Run build-portfolio before report.`);
    }

    throw error;
  });

  const inventory = await readJsonFileIfExists(inventoryPath);
  const policyOverlay = await loadPolicyOverlay(policyPath);
  const presentationOverridesPath = resolvePresentationOverridesPath(options);
  const presentationOverrides = await loadPresentationOverrides(presentationOverridesPath);
  const reportModel = buildReportModel(portfolio, inventory, { policyOverlay });

  if (presentationOverrides.size > 0) {
    reportModel.items = applyPresentationOverrides(reportModel.items, presentationOverrides);
  }

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

  if (!quiet) {
    success(`✓ Generated portfolio decision report for ${reportModel.meta.counts.total} items`);
    for (const filePath of writtenPaths) {
      success(`✓ Wrote ${filePath}`);
    }
  }

  if (formatOption === 'json') {
    process.stdout.write(`${JSON.stringify(reportModel, null, 2)}\n`);
  }

  if (explain && !quiet) {
    printNowExplain(reportModel);
  }
}

function resolvePresentationOverridesPath(options) {
  if (typeof options['presentation-overrides'] === 'string') {
    return options['presentation-overrides'];
  }
  return 'priorities/presentation-overrides.json';
}

function resolvePolicyPath(options) {
  if (typeof options.policy === 'string') {
    return options.policy;
  }

  if (typeof options.priorities === 'string') {
    return options.priorities;
  }

  return null;
}

async function loadPolicyOverlay(policyPath) {
  if (!policyPath) {
    return null;
  }

  const policy = await readJsonFile(policyPath).catch((error) => {
    if (error && error.code === 'ENOENT') {
      throw new Error(`Policy file not found: ${policyPath}`);
    }

    throw error;
  });

  validatePolicyOverlay(policy, policyPath);
  return policy;
}

function validatePolicyOverlay(policy, policyPath) {
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new Error(`Invalid policy file at ${policyPath}: expected a JSON object.`);
  }

  if (policy.version !== undefined && policy.version !== 1) {
    throw new Error(`Invalid policy file at ${policyPath}: unsupported version ${policy.version}. Expected 1.`);
  }
}

function printNowExplain(reportModel) {
  const nowItems = Array.isArray(reportModel?.items)
    ? reportModel.items.filter((item) => item.priorityBand === 'now')
    : [];

  console.log('');
  console.log('Explain mode: NOW ranking');
  if (nowItems.length === 0) {
    console.log('No items in NOW band.');
    return;
  }

  for (const item of nowItems) {
    const boosts = (item.priorityOverrides ?? [])
      .filter((entry) => Number(entry.boost ?? 0) !== 0)
      .map((entry) => `${formatSignedNumber(entry.boost)} (${entry.ruleId})`);
    const reasons = (item.priorityOverrides ?? [])
      .map((entry) => entry.reason)
      .filter((entry) => typeof entry === 'string' && entry.trim().length > 0);

    console.log(item.slug);
    console.log(`  Base score: ${item.basePriorityScore}`);
    console.log(`  Repo score: ${item.score}`);
    console.log(`  Signals: ${buildBaseSignalsLine(item)}`);
    console.log(`  Boosts: ${boosts.length > 0 ? boosts.join(', ') : 'none'}`);
    console.log(`  Final score: ${item.finalPriorityScore}`);
    console.log(`  Final band: ${item.priorityBand}`);
    console.log(`  Reason(s): ${reasons.length > 0 ? reasons.join('; ') : 'none'}`);
    console.log(`  Next: ${item.nextAction}`);
  }
}

function buildBaseSignalsLine(item) {
  const state = String(item.state ?? '').toLowerCase();
  const completionLevel = Number(item.completionLevel ?? 0);
  const effortEstimate = String(item.effortEstimate ?? '').toLowerCase();

  const stateAdjustment = computeStateAdjustment(state);
  const completionAdjustment = completionLevel >= 1 && completionLevel <= 3 ? 10 : 0;
  const effortAdjustment = effortEstimate === 'l' || effortEstimate === 'xl' ? -10 : 0;

  return [
    `score=${Number(item.score ?? 0)}`,
    `state(${state || 'unknown'})=${formatSignedNumber(stateAdjustment)}`,
    `completion(CL${completionLevel})=${formatSignedNumber(completionAdjustment)}`,
    `effort(${effortEstimate || 'm'})=${formatSignedNumber(effortAdjustment)}`
  ].join('; ');
}

function computeStateAdjustment(state) {
  if (state === 'active') {
    return 10;
  }

  if (state === 'stale') {
    return 5;
  }

  if (state === 'abandoned' || state === 'archived') {
    return -20;
  }

  return 0;
}

function formatSignedNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '+0';
  }

  return numeric >= 0 ? `+${numeric}` : String(numeric);
}
