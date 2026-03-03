import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import {
  buildReportModel,
  computeCompletionLevel,
  computePriorityBand
} from '../src/core/report.js';
import { runReportCommand } from '../src/commands/report.js';
import { readJsonFile, fileExists } from '../src/io/files.js';

test('computeCompletionLevel follows repo boundaries and idea default', () => {
  const repoBase = {
    type: 'repo',
    score: 80,
    structuralHealth: {
      hasReadme: false,
      hasPackageJson: false,
      hasCi: false,
      hasTests: false
    },
    language: 'JavaScript',
    sizeKb: 42
  };

  assert.equal(computeCompletionLevel(repoBase), 0);

  const cl1 = {
    ...repoBase,
    structuralHealth: { ...repoBase.structuralHealth, hasReadme: true }
  };
  assert.equal(computeCompletionLevel(cl1), 1);

  const cl2Package = {
    ...cl1,
    structuralHealth: { ...cl1.structuralHealth, hasPackageJson: true }
  };
  assert.equal(computeCompletionLevel(cl2Package), 2);

  const cl2NonJsLarge = {
    ...cl1,
    language: 'Go',
    sizeKb: 700
  };
  assert.equal(computeCompletionLevel(cl2NonJsLarge), 2);

  const cl3 = {
    ...cl2Package,
    structuralHealth: { ...cl2Package.structuralHealth, hasCi: true }
  };
  assert.equal(computeCompletionLevel(cl3), 3);

  const cl4 = {
    ...cl3,
    score: 60,
    structuralHealth: { ...cl3.structuralHealth, hasTests: true }
  };
  assert.equal(computeCompletionLevel(cl4), 4);

  const cl5 = {
    ...cl4,
    score: 70
  };
  assert.equal(computeCompletionLevel(cl5), 5);

  const idea = {
    type: 'idea',
    score: 100
  };
  assert.equal(computeCompletionLevel(idea), 0);
});

test('computePriorityBand maps scores into now/next/later/park', () => {
  const now = computePriorityBand({ score: 72, state: 'active', completionLevel: 2, effortEstimate: 's' });
  assert.equal(now.priorityBand, 'now');

  const next = computePriorityBand({ score: 60, state: 'stale', completionLevel: 2, effortEstimate: 'm' });
  assert.equal(next.priorityBand, 'next');

  const later = computePriorityBand({ score: 50, state: 'stale', completionLevel: 4, effortEstimate: 'l' });
  assert.equal(later.priorityBand, 'later');

  const park = computePriorityBand({ score: 35, state: 'archived', completionLevel: 0, effortEstimate: 'xl' });
  assert.equal(park.priorityBand, 'park');
});

test('buildReportModel is deterministic when ignoring generatedAt', () => {
  const portfolio = {
    meta: {
      asOfDate: '2026-03-03'
    },
    items: [
      {
        slug: 'zeta',
        type: 'idea',
        title: 'Zeta idea',
        score: 66,
        state: 'idea',
        effort: 'm',
        value: 'medium',
        taxonomyMeta: { sources: { effort: 'default' } },
        nextAction: 'Define scope — Done when: acceptance checks are listed.'
      },
      {
        slug: 'alpha',
        type: 'repo',
        fullName: 'owner/alpha',
        score: 70,
        state: 'active',
        effort: 'm',
        value: 'high',
        taxonomyMeta: { sources: { effort: 'default' } },
        structuralHealth: {
          hasReadme: true,
          hasPackageJson: true,
          hasCi: true,
          hasTests: true
        },
        sizeKb: 250,
        language: 'TypeScript',
        nextAction: 'Ship patch release — Done when: release notes are published.'
      },
      {
        slug: 'beta',
        type: 'repo',
        fullName: 'owner/beta',
        score: 40,
        state: 'abandoned',
        effort: 'l',
        value: 'low',
        taxonomyMeta: { sources: { effort: 'user' } },
        structuralHealth: {
          hasReadme: true,
          hasPackageJson: false,
          hasCi: false,
          hasTests: false
        },
        sizeKb: 8000,
        language: 'Go',
        nextAction: 'Decide archive plan — Done when: README documents ownership decision.'
      }
    ]
  };

  const inventory = {
    meta: {
      owner: 'octocat'
    },
    items: []
  };

  const first = buildReportModel(portfolio, inventory);
  const second = buildReportModel(portfolio, inventory);

  delete first.meta.generatedAt;
  delete second.meta.generatedAt;

  assert.deepEqual(first, second);
  assert.equal(first.summary.top10ByScore[0].slug, 'alpha');

  const allowedEffortValues = new Set(['xs', 's', 'm', 'l', 'xl']);

  for (const item of first.items) {
    assert.equal(allowedEffortValues.has(item.effortEstimate), true);
  }

  for (const sectionName of ['top10ByScore', 'now', 'next', 'later', 'park']) {
    for (const item of first.summary[sectionName]) {
      assert.equal(allowedEffortValues.has(item.effortEstimate), true);
    }
  }
});

test('report command generates all outputs from portfolio-only input', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'gpa-report-'));
  const outputDir = path.join(workspace, 'output');
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, 'portfolio.json'),
    JSON.stringify({
      meta: {
        generatedAt: '2026-03-03T00:00:00.000Z',
        asOfDate: null,
        count: 1
      },
      items: [
        {
          slug: 'single-idea',
          type: 'idea',
          title: 'Single Idea',
          score: 81,
          state: 'idea',
          effort: 'm',
          value: 'medium',
          taxonomyMeta: { sources: { effort: 'default' } },
          nextAction: 'Define MVP — Done when: acceptance checks are documented.'
        }
      ]
    }, null, 2),
    'utf8'
  );

  await runReportCommand({ 'output-dir': outputDir, format: 'all' });

  assert.equal(await fileExists(path.join(outputDir, 'portfolio-report.json')), true);
  assert.equal(await fileExists(path.join(outputDir, 'portfolio-report.md')), true);
  assert.equal(await fileExists(path.join(outputDir, 'portfolio-report.txt')), true);

  const model = await readJsonFile(path.join(outputDir, 'portfolio-report.json'));
  assert.equal(model.meta.asOfDate, null);
  assert.equal(model.meta.owner, null);
  assert.equal(model.meta.counts.ideas, 1);
});

test('no-policy report output is identical to empty policy overlay', () => {
  const portfolio = {
    meta: { asOfDate: '2026-03-03' },
    items: [
      {
        slug: 'alpha',
        type: 'repo',
        fullName: 'owner/alpha',
        score: 70,
        state: 'active',
        effort: 'm',
        value: 'high',
        category: 'tooling',
        strategy: 'maintenance',
        taxonomyMeta: { sources: { effort: 'default' } },
        structuralHealth: {
          hasReadme: true,
          hasPackageJson: true,
          hasCi: true,
          hasTests: true
        },
        sizeKb: 250,
        language: 'TypeScript',
        nextAction: 'Ship patch release — Done when: release notes are published.'
      }
    ]
  };

  const base = buildReportModel(portfolio, null, { generatedAt: '2026-03-03T00:00:00.000Z' });
  const withEmptyPolicy = buildReportModel(portfolio, null, {
    generatedAt: '2026-03-03T00:00:00.000Z',
    policyOverlay: { version: 1 }
  });

  assert.deepEqual(base, withEmptyPolicy);
});

test('policy rules are applied in deterministic id order with cumulative boosts', () => {
  const portfolio = {
    meta: { asOfDate: '2026-03-03' },
    items: [
      {
        slug: 'alpha-repo',
        type: 'repo',
        fullName: 'owner/alpha-repo',
        title: 'Alpha Repo',
        score: 60,
        state: 'active',
        effort: 'm',
        value: 'high',
        category: 'tooling',
        strategy: 'maintenance',
        taxonomyMeta: { sources: { effort: 'user' } },
        structuralHealth: {
          hasReadme: true,
          hasPackageJson: true,
          hasCi: false,
          hasTests: false
        },
        sizeKb: 1000,
        language: 'TypeScript',
        nextAction: 'Ship patch release — Done when: release notes are published.'
      }
    ]
  };

  const report = buildReportModel(portfolio, null, {
    generatedAt: '2026-03-03T00:00:00.000Z',
    policyOverlay: {
      version: 1,
      rules: [
        {
          id: 'z-rule',
          match: { slugContains: ['alpha-repo'] },
          effects: { boost: 5 },
          reason: 'later id'
        },
        {
          id: 'a-rule',
          match: { slugContains: ['alpha-repo'] },
          effects: { boost: 8 },
          reason: 'earlier id'
        }
      ]
    }
  });

  const item = report.items[0];
  assert.equal(item.basePriorityScore, 80);
  assert.equal(item.finalPriorityScore, 93);
  assert.deepEqual(
    item.priorityOverrides.map((entry) => entry.ruleId),
    ['a-rule', 'z-rule']
  );
});

test('pin band overrides forceBand and regular boosts', () => {
  const portfolio = {
    meta: { asOfDate: '2026-03-03' },
    items: [
      {
        slug: 'alpha-repo',
        type: 'repo',
        fullName: 'owner/alpha-repo',
        score: 95,
        state: 'active',
        effort: 's',
        value: 'high',
        category: 'tooling',
        strategy: 'maintenance',
        taxonomyMeta: { sources: { effort: 'user' } },
        structuralHealth: {
          hasReadme: true,
          hasPackageJson: true,
          hasCi: true,
          hasTests: true
        },
        sizeKb: 300,
        language: 'TypeScript',
        nextAction: 'Ship patch release — Done when: release notes are published.'
      }
    ]
  };

  const report = buildReportModel(portfolio, null, {
    generatedAt: '2026-03-03T00:00:00.000Z',
    policyOverlay: {
      version: 1,
      rules: [
        {
          id: 'force-now',
          match: { slugContains: ['alpha-repo'] },
          effects: { forceBand: 'now', boost: 20 }
        }
      ],
      pin: [
        {
          slug: 'alpha-repo',
          band: 'park',
          tag: 'manual-park'
        }
      ]
    }
  });

  const item = report.items[0];
  assert.equal(item.priorityBand, 'park');
  assert.equal(item.priorityTag, 'manual-park');
});

test('forceBand precedence chooses strongest forced band', () => {
  const portfolio = {
    meta: { asOfDate: '2026-03-03' },
    items: [
      {
        slug: 'alpha-repo',
        type: 'repo',
        fullName: 'owner/alpha-repo',
        score: 20,
        state: 'abandoned',
        effort: 'm',
        value: 'medium',
        category: 'tooling',
        strategy: 'maintenance',
        taxonomyMeta: { sources: { effort: 'user' } },
        structuralHealth: {
          hasReadme: true,
          hasPackageJson: true,
          hasCi: false,
          hasTests: false
        },
        sizeKb: 200,
        language: 'TypeScript',
        nextAction: 'Decide archive plan — Done when: ownership is documented.'
      }
    ]
  };

  const report = buildReportModel(portfolio, null, {
    generatedAt: '2026-03-03T00:00:00.000Z',
    policyOverlay: {
      version: 1,
      rules: [
        {
          id: 'force-later',
          match: { slugContains: ['alpha-repo'] },
          effects: { forceBand: 'later' }
        },
        {
          id: 'force-now',
          match: { slugContains: ['alpha-repo'] },
          effects: { forceBand: 'now' }
        }
      ]
    }
  });

  assert.equal(report.items[0].priorityBand, 'now');
});

test('pinned without band applies deterministic boost', () => {
  const portfolio = {
    meta: { asOfDate: '2026-03-03' },
    items: [
      {
        slug: 'alpha-repo',
        type: 'repo',
        fullName: 'owner/alpha-repo',
        score: 30,
        state: 'stale',
        effort: 'm',
        value: 'medium',
        category: 'tooling',
        strategy: 'maintenance',
        taxonomyMeta: { sources: { effort: 'user' } },
        structuralHealth: {
          hasReadme: true,
          hasPackageJson: true,
          hasCi: false,
          hasTests: false
        },
        sizeKb: 200,
        language: 'TypeScript',
        nextAction: 'Refresh docs — Done when: setup steps are validated.'
      }
    ]
  };

  const report = buildReportModel(portfolio, null, {
    generatedAt: '2026-03-03T00:00:00.000Z',
    policyOverlay: {
      version: 1,
      pin: [
        {
          slug: 'alpha-repo'
        }
      ]
    }
  });

  const item = report.items[0];
  assert.equal(item.basePriorityScore, 45);
  assert.equal(item.finalPriorityScore, 145);
});

test('report command explain mode does not change report json', { concurrency: false }, async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'gpa-report-explain-'));
  const outputDir = path.join(workspace, 'output');
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, 'portfolio.json'),
    JSON.stringify({
      meta: {
        generatedAt: '2026-03-03T00:00:00.000Z',
        asOfDate: '2026-03-03',
        count: 1
      },
      items: [
        {
          slug: 'single-idea',
          type: 'idea',
          title: 'Single Idea',
          score: 81,
          state: 'idea',
          effort: 'm',
          value: 'medium',
          category: 'experiment',
          strategy: 'parked',
          taxonomyMeta: { sources: { effort: 'default' } },
          nextAction: 'Define MVP — Done when: acceptance checks are documented.'
        }
      ]
    }, null, 2),
    'utf8'
  );

  await runReportCommand({ 'output-dir': outputDir, format: 'json' });
  const first = await readJsonFile(path.join(outputDir, 'portfolio-report.json'));

  const capturedLogs = [];
  const originalLog = console.log;
  console.log = (...args) => {
    capturedLogs.push(args.join(' '));
  };

  try {
    await runReportCommand({ 'output-dir': outputDir, format: 'json', explain: true });
  } finally {
    console.log = originalLog;
  }

  const second = await readJsonFile(path.join(outputDir, 'portfolio-report.json'));

  delete first.meta.generatedAt;
  delete second.meta.generatedAt;
  assert.deepEqual(first, second);

  const output = capturedLogs.join('\n');
  assert.match(output, /Repo score:/);
  assert.match(output, /Signals:/);
  assert.match(output, /Next:/);
});

test('report command fails with clear error when policy file is missing', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'gpa-report-policy-missing-'));
  const outputDir = path.join(workspace, 'output');
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, 'portfolio.json'),
    JSON.stringify({
      meta: {
        generatedAt: '2026-03-03T00:00:00.000Z',
        asOfDate: null,
        count: 0
      },
      items: []
    }, null, 2),
    'utf8'
  );

  await assert.rejects(
    () => runReportCommand({ 'output-dir': outputDir, policy: path.join(workspace, 'missing-policy.json') }),
    /Policy file not found/
  );
});
