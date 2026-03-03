import { utcNowISOString } from '../utils/time.js';

const STATE_ORDER = ['active', 'stale', 'abandoned', 'archived', 'idea', 'reference-only'];
const EFFORT_ORDER = ['xs', 's', 'm', 'l', 'xl'];

export function computeCompletionLevel(item, repositorySignals = null) {
  if (resolveItemType(item) === 'idea') {
    return 0;
  }

  const signals = resolveRepositorySignals(item, repositorySignals);

  if (!signals.hasReadme) {
    return 0;
  }

  let level = 1;

  if (signals.hasPackageJson || signals.nonJavascriptLargeRepo) {
    level = 2;
  } else {
    return level;
  }

  if (signals.hasCi) {
    level = 3;
  } else {
    return level;
  }

  if (signals.hasTests) {
    level = 4;
  } else {
    return level;
  }

  if (signals.hasReadme && signals.hasCi && signals.hasTests && Number(item.score ?? 0) >= 70) {
    level = 5;
  }

  return level;
}

export function completionLabelFor(level) {
  if (level === 0) {
    return 'Concept only';
  }

  if (level === 1) {
    return 'Documented';
  }

  if (level === 2) {
    return 'Structured baseline';
  }

  if (level === 3) {
    return 'Automated workflow';
  }

  if (level === 4) {
    return 'Tested workflow';
  }

  return 'Production-ready candidate';
}

export function computeEffortEstimate(item, completionLevel, repositorySignals = null) {
  const original = normalizeEffort(item.effort);
  const source = item?.taxonomyMeta?.sources?.effort;

  if (original && source !== 'default') {
    return original;
  }

  const sizeKb = resolveRepositorySignals(item, repositorySignals).sizeKb;

  if (sizeKb < 100 && completionLevel <= 2) {
    return 'xs';
  }

  if (sizeKb < 500 && completionLevel <= 3) {
    return 's';
  }

  if (sizeKb < 5000) {
    return 'm';
  }

  if (sizeKb < 20000) {
    return 'l';
  }

  return 'xl';
}

export function computePriorityBand(input) {
  const score = Number(input.score ?? 0);
  const state = String(input.state ?? '').toLowerCase();
  const completionLevel = Number(input.completionLevel ?? 0);
  const effortEstimate = normalizeEffort(input.effortEstimate) ?? 'm';

  let priorityScore = score;
  const reasons = [`Base score: ${score}`];

  if (state === 'active') {
    priorityScore += 10;
    reasons.push('State boost: active (+10)');
  } else if (state === 'stale') {
    priorityScore += 5;
    reasons.push('State boost: stale (+5)');
  } else if (state === 'abandoned' || state === 'archived') {
    priorityScore -= 20;
    reasons.push('State penalty: abandoned/archived (-20)');
  }

  if (completionLevel >= 1 && completionLevel <= 3) {
    priorityScore += 10;
    reasons.push('Quick-win zone boost: completion level 1-3 (+10)');
  }

  if (effortEstimate === 'l' || effortEstimate === 'xl') {
    priorityScore -= 10;
    reasons.push('Large effort penalty: l/xl (-10)');
  }

  const priorityBand = priorityBandFromScore(priorityScore);
  reasons.push(`Priority band: ${priorityBand} (score ${priorityScore})`);

  return {
    priorityBand,
    priorityScore,
    priorityWhy: reasons
  };
}

export function buildReportModel(portfolioData, inventoryData = null, options = {}) {
  const portfolioItems = Array.isArray(portfolioData?.items) ? portfolioData.items : [];
  const inventoryItems = Array.isArray(inventoryData?.items) ? inventoryData.items : [];

  const inventoryLookup = buildInventoryLookup(inventoryItems);

  const reportItems = portfolioItems.map((item) => {
    const slug = String(item.slug ?? '').trim();
    const inventorySignals = inventoryLookup.get(slug) ?? null;

    const completionLevel = computeCompletionLevel(item, inventorySignals);
    const effortEstimate = computeEffortEstimate(item, completionLevel, inventorySignals);
    const { priorityBand, priorityScore, priorityWhy } = computePriorityBand({
      score: item.score,
      state: item.state,
      completionLevel,
      effortEstimate
    });

    return {
      slug,
      type: resolveItemType(item),
      title: resolveTitle(item),
      score: Number(item.score ?? 0),
      state: String(item.state ?? 'idea'),
      effort: normalizeEffort(item.effort) ?? 'm',
      value: String(item.value ?? 'medium'),
      completionLevel,
      completionLabel: completionLabelFor(completionLevel),
      effortEstimate,
      priorityBand,
      priorityScore,
      priorityWhy,
      nextAction: String(item.nextAction ?? '').trim()
    };
  });

  const sortedByScore = [...reportItems].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.slug.localeCompare(right.slug);
  });

  const sortedByPriority = [...reportItems].sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.slug.localeCompare(right.slug);
  });

  const byState = buildByStateSummary(reportItems);
  const byBand = {
    now: topItemsInBand(sortedByPriority, 'now', 5),
    next: topItemsInBand(sortedByPriority, 'next', 5),
    later: topItemsInBand(sortedByPriority, 'later', 5),
    park: topItemsInBand(sortedByPriority, 'park', 5)
  };

  const matrix = buildCompletionByEffortMatrix(reportItems);

  return {
    meta: {
      generatedAt:
        typeof options.generatedAt === 'string' && options.generatedAt.trim().length > 0
          ? options.generatedAt
          : utcNowISOString(),
      asOfDate: portfolioData?.meta?.asOfDate ?? null,
      owner: inventoryData?.meta?.owner ?? null,
      counts: {
        total: reportItems.length,
        repos: reportItems.filter((item) => item.type === 'repo').length,
        ideas: reportItems.filter((item) => item.type === 'idea').length
      }
    },
    summary: {
      byState,
      top10ByScore: sortedByScore.slice(0, 10).map(toSummaryItem),
      now: byBand.now.map(toSummaryItem),
      next: byBand.next.map(toSummaryItem),
      later: byBand.later.map(toSummaryItem),
      park: byBand.park.map(toSummaryItem)
    },
    matrix: {
      completionByEffort: matrix
    },
    items: sortedByPriority.map(({ priorityScore: _priorityScore, ...item }) => item)
  };
}

export function stateOrder() {
  return [...STATE_ORDER];
}

export function effortOrder() {
  return [...EFFORT_ORDER];
}

function buildInventoryLookup(inventoryItems) {
  const lookup = new Map();

  for (const item of inventoryItems) {
    const slug = String(item.slug ?? '').trim();
    if (!slug) {
      continue;
    }

    lookup.set(slug, item);
  }

  return lookup;
}

function buildByStateSummary(reportItems) {
  const summary = {
    active: 0,
    stale: 0,
    abandoned: 0,
    archived: 0,
    idea: 0,
    'reference-only': 0
  };

  for (const item of reportItems) {
    if (Object.hasOwn(summary, item.state)) {
      summary[item.state] += 1;
    }
  }

  return summary;
}

function buildCompletionByEffortMatrix(reportItems) {
  const matrix = {
    CL0: createEffortRow(),
    CL1: createEffortRow(),
    CL2: createEffortRow(),
    CL3: createEffortRow(),
    CL4: createEffortRow(),
    CL5: createEffortRow()
  };

  for (const item of reportItems) {
    const levelKey = `CL${item.completionLevel}`;
    if (!Object.hasOwn(matrix, levelKey)) {
      continue;
    }

    const effort = normalizeEffort(item.effortEstimate);
    if (!effort) {
      continue;
    }

    matrix[levelKey][effort] += 1;
  }

  return matrix;
}

function createEffortRow() {
  return {
    xs: 0,
    s: 0,
    m: 0,
    l: 0,
    xl: 0
  };
}

function topItemsInBand(items, band, count) {
  return items.filter((item) => item.priorityBand === band).slice(0, count);
}

function toSummaryItem(item) {
  return {
    slug: item.slug,
    type: item.type,
    score: item.score,
    state: item.state,
    effort: item.effort,
    value: item.value,
    completionLevel: item.completionLevel,
    priorityBand: item.priorityBand,
    priorityWhy: item.priorityWhy,
    nextAction: item.nextAction
  };
}

function resolveRepositorySignals(item, repositorySignals) {
  const source = repositorySignals ?? item ?? {};
  const structural = source.structuralHealth ?? {};
  const language = String(source.language ?? item?.language ?? '').trim().toLowerCase();
  const sizeKb = Number(source.sizeKb ?? item?.sizeKb ?? 0);

  return {
    hasReadme: Boolean(structural.hasReadme),
    hasPackageJson: Boolean(structural.hasPackageJson),
    hasCi: Boolean(structural.hasCi),
    hasTests: Boolean(structural.hasTests),
    nonJavascriptLargeRepo: isNonJavascript(language) && sizeKb >= 500,
    sizeKb: Number.isFinite(sizeKb) ? sizeKb : 0
  };
}

function isNonJavascript(language) {
  if (!language) {
    return false;
  }

  return !['javascript', 'typescript'].includes(language);
}

function resolveItemType(item) {
  if (item?.type === 'repo' || item?.type === 'idea') {
    return item.type;
  }

  if (typeof item?.status === 'string') {
    return 'idea';
  }

  return 'repo';
}

function resolveTitle(item) {
  return String(item.title ?? item.fullName ?? item.name ?? item.slug ?? 'untitled').trim();
}

function normalizeEffort(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['xs', 's', 'm', 'l', 'xl'].includes(normalized)) {
    return normalized;
  }

  return null;
}

function priorityBandFromScore(priorityScore) {
  if (priorityScore >= 80) {
    return 'now';
  }

  if (priorityScore >= 65) {
    return 'next';
  }

  if (priorityScore >= 45) {
    return 'later';
  }

  return 'park';
}
