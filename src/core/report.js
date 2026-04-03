import { utcNowISOString } from '../utils/time.js';

const STATE_ORDER = ['active', 'stale', 'abandoned', 'archived', 'idea', 'reference-only'];
const EFFORT_ORDER = ['xs', 's', 'm', 'l', 'xl'];
const BAND_STRENGTH = {
  park: 0,
  later: 1,
  next: 2,
  now: 3
};
const PIN_WITHOUT_BAND_BOOST = 100;

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
  const baseline = normalizeEffort(item?.effort) ?? 'm';
  const source = item?.taxonomyMeta?.sources?.effort;

  let estimate = baseline;

  if (source === 'default') {
    try {
      const rawSizeKb = repositorySignals?.sizeKb ?? item?.sizeKb;
      const sizeKb = Number(rawSizeKb);
      if (!Number.isFinite(sizeKb)) {
        throw new Error('Missing sizeKb for effort inference');
      }
      estimate = inferEffortEstimate(sizeKb, completionLevel);
    } catch {
      return 'm';
    }
  }

  return normalizeEffort(estimate) ?? 'm';
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
  const policyOverlay = normalizePolicyOverlay(options.policyOverlay);

  const inventoryLookup = buildInventoryLookup(inventoryItems);

  const reportItems = portfolioItems.map((item) => {
    const rawSlug = String(item.slug ?? '').trim();
    const inventorySignals = inventoryLookup.get(rawSlug) ?? null;
    const isPrivate = Boolean(item.private);
    const alias = typeof item.publicAlias === 'string' && item.publicAlias.trim()
      ? item.publicAlias.trim()
      : null;
    const slug = isPrivate && alias ? alias : rawSlug;
    const rawTitle = resolveTitle(item);
    const title = isPrivate && alias ? alias : rawTitle;

    const completionLevel = computeCompletionLevel(item, inventorySignals);
    const effortEstimate = computeEffortEstimate(item, completionLevel, inventorySignals);
    const { priorityBand, priorityScore, priorityWhy } = computePriorityBand({
      score: item.score,
      state: item.state,
      completionLevel,
      effortEstimate
    });

    const {
      priorityBand: finalBand,
      finalPriorityScore,
      priorityTag,
      priorityOverrides,
      policyReasons
    } = applyPolicyOverlayToItem(
      {
        ...item,
        slug: rawSlug,
        type: resolveItemType(item),
        title: rawTitle,
        tags: collectItemTags(item)
      },
      {
        basePriorityScore: priorityScore,
        basePriorityBand: priorityBand
      },
      policyOverlay
    );

    const priorityWhyWithPolicy = [...priorityWhy, ...policyReasons];

    return {
      slug,
      type: resolveItemType(item),
      title,
      score: Number(item.score ?? 0),
      state: String(item.state ?? 'idea'),
      effort: normalizeEffort(item.effort) ?? 'm',
      value: String(item.value ?? 'medium'),
      completionLevel,
      completionLabel: completionLabelFor(completionLevel),
      effortEstimate,
      basePriorityScore: priorityScore,
      finalPriorityScore,
      priorityBand: finalBand,
      ...(priorityTag ? { priorityTag } : {}),
      priorityOverrides,
      priorityScore: finalPriorityScore,
      priorityWhy: priorityWhyWithPolicy,
      nextAction: String(item.nextAction ?? '').trim(),
      // presentation fields — passed directly from portfolio item
      ...(item.language != null ? { language: item.language } : {}),
      ...(Array.isArray(item.topics) && item.topics.length > 0 ? { topics: item.topics } : {}),
      ...(!isPrivate && item.htmlUrl != null ? { htmlUrl: item.htmlUrl } : {}),
      ...(!isPrivate && item.homepage != null ? { homepage: item.homepage } : {}),
      ...(item.category != null ? { category: item.category } : {}),
      ...(item.fork != null ? { fork: Boolean(item.fork) } : {}),
      ...(item.forkType != null ? { forkType: item.forkType } : {}),
      ...(item.private != null ? { private: Boolean(item.private) } : {}),
      ...(item.publicAlias != null ? { publicAlias: item.publicAlias } : {}),
      ...(!isPrivate && item.description != null ? { description: item.description } : {}),
      ...(isPrivate && item.description != null ? { _description: item.description } : {})
    };
  });

  const sortedByScore = [...reportItems].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.slug.localeCompare(right.slug);
  });

  const sortedByPriority = [...reportItems].sort((left, right) => {
    if (right.finalPriorityScore !== left.finalPriorityScore) {
      return right.finalPriorityScore - left.finalPriorityScore;
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
    items: sortedByPriority.map((item) => {
      const publicItem = { ...item };
      delete publicItem.priorityScore;
      delete publicItem._description;
      return publicItem;
    })
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
    effortEstimate: normalizeEffort(item.effortEstimate) ?? 'm',
    value: item.value,
    completionLevel: item.completionLevel,
    basePriorityScore: item.basePriorityScore,
    finalPriorityScore: item.finalPriorityScore,
    priorityBand: item.priorityBand,
    ...(item.priorityTag ? { priorityTag: item.priorityTag } : {}),
    priorityOverrides: item.priorityOverrides,
    priorityWhy: item.priorityWhy,
    nextAction: item.nextAction,
    ...(item.category != null ? { category: item.category } : {})
  };
}

function applyPolicyOverlayToItem(item, basePriority, policyOverlay) {
  const matchedRules = policyOverlay.rules.filter((rule) => ruleMatches(rule.match, item));
  const pinEntry = policyOverlay.pinBySlug.get(item.slug) ?? null;

  let finalPriorityScore = basePriority.basePriorityScore;
  let strongestForcedBand = null;
  let priorityTag = null;
  const priorityOverrides = [];
  const policyReasons = [];

  for (const rule of matchedRules) {
    finalPriorityScore += rule.effects.boost;

    if (!priorityTag && rule.effects.tag) {
      priorityTag = rule.effects.tag;
    }

    if (rule.effects.forceBand && isStrongerBand(rule.effects.forceBand, strongestForcedBand)) {
      strongestForcedBand = rule.effects.forceBand;
    }

    priorityOverrides.push({
      ruleId: rule.id,
      boost: rule.effects.boost,
      ...(rule.effects.forceBand ? { forceBand: rule.effects.forceBand } : {}),
      reason: rule.reason
    });

    const effectSummary = [];
    if (rule.effects.boost !== 0) {
      effectSummary.push(`boost ${formatSignedNumber(rule.effects.boost)}`);
    }
    if (rule.effects.forceBand) {
      effectSummary.push(`forceBand ${rule.effects.forceBand}`);
    }
    if (rule.effects.tag) {
      effectSummary.push(`tag ${rule.effects.tag}`);
    }
    if (effectSummary.length > 0) {
      policyReasons.push(`Policy ${rule.id}: ${effectSummary.join(', ')}`);
    }
    if (rule.reason) {
      policyReasons.push(`Policy ${rule.id} reason: ${rule.reason}`);
    }
  }

  if (pinEntry) {
    if (pinEntry.band) {
      priorityOverrides.push({
        ruleId: `pin:${pinEntry.slug}`,
        boost: 0,
        forceBand: pinEntry.band,
        reason: 'Pinned band from policy'
      });
      if (pinEntry.tag) {
        priorityTag = pinEntry.tag;
      }
      policyReasons.push(`Pinned to ${pinEntry.band} by policy`);
    } else {
      finalPriorityScore += PIN_WITHOUT_BAND_BOOST;
      priorityOverrides.push({
        ruleId: `pin:${pinEntry.slug}`,
        boost: PIN_WITHOUT_BAND_BOOST,
        reason: 'Pinned boost from policy'
      });
      if (pinEntry.tag) {
        priorityTag = pinEntry.tag;
      }
      policyReasons.push(`Pinned boost applied (${formatSignedNumber(PIN_WITHOUT_BAND_BOOST)})`);
    }
  }

  const priorityBand = resolveFinalBand({
    pinBand: pinEntry?.band ?? null,
    forcedBand: strongestForcedBand,
    finalPriorityScore
  });

  if (priorityTag) {
    policyReasons.push(`Priority tag: ${priorityTag}`);
  }

  return {
    finalPriorityScore,
    priorityBand,
    priorityTag,
    priorityOverrides,
    policyReasons
  };
}

function resolveFinalBand(input) {
  if (input.pinBand) {
    return input.pinBand;
  }

  if (input.forcedBand) {
    return input.forcedBand;
  }

  return priorityBandFromScore(input.finalPriorityScore);
}

function normalizePolicyOverlay(policyOverlay) {
  const source = policyOverlay ?? {};
  const rules = Array.isArray(source.rules) ? source.rules : [];
  const pin = Array.isArray(source.pin) ? source.pin : [];

  const normalizedRules = rules
    .map((rule, index) => normalizePolicyRule(rule, index))
    .sort((left, right) => left.id.localeCompare(right.id));

  const normalizedPins = pin
    .map((entry, index) => normalizePolicyPin(entry, index))
    .sort((left, right) => left.slug.localeCompare(right.slug));

  return {
    rules: normalizedRules,
    pinBySlug: consolidatePins(normalizedPins)
  };
}

function normalizePolicyRule(rule, index) {
  const id = String(rule?.id ?? '').trim();
  if (!id) {
    throw new Error(`Invalid policy rule at index ${index}: missing id`);
  }

  const effects = rule?.effects ?? {};
  const boostRaw = Number(effects.boost ?? 0);
  if (!Number.isFinite(boostRaw)) {
    throw new Error(`Invalid policy rule ${id}: effects.boost must be a number`);
  }

  const forceBand = normalizeBand(effects.forceBand);
  const tag = normalizeOptionalString(effects.tag);
  const reason = normalizeOptionalString(rule?.reason) ?? '';

  return {
    id,
    match: normalizePolicyMatch(rule?.match),
    effects: {
      boost: boostRaw,
      ...(forceBand ? { forceBand } : {}),
      ...(tag ? { tag } : {})
    },
    reason
  };
}

function normalizePolicyMatch(match) {
  const source = match ?? {};

  return {
    slugContains: normalizeStringArray(source.slugContains),
    fullNameContains: normalizeStringArray(source.fullNameContains),
    titleContains: normalizeStringArray(source.titleContains),
    tagsAny: normalizeStringArray(source.tagsAny),
    type: normalizeStringArray(source.type),
    state: normalizeStringArray(source.state),
    category: normalizeStringArray(source.category),
    strategy: normalizeStringArray(source.strategy)
  };
}

function normalizePolicyPin(entry, index) {
  const slug = String(entry?.slug ?? '').trim();
  if (!slug) {
    throw new Error(`Invalid policy pin at index ${index}: missing slug`);
  }

  const band = normalizeBand(entry?.band);
  const tag = normalizeOptionalString(entry?.tag);

  return {
    slug,
    ...(band ? { band } : {}),
    ...(tag ? { tag } : {})
  };
}

function consolidatePins(pins) {
  const result = new Map();

  for (const pin of pins) {
    const existing = result.get(pin.slug);
    if (!existing) {
      result.set(pin.slug, pin);
      continue;
    }

    const strongestBand =
      isStrongerBand(pin.band ?? null, existing.band ?? null) ? pin.band ?? null : existing.band ?? null;
    const tag = existing.tag ?? pin.tag;

    result.set(pin.slug, {
      slug: pin.slug,
      ...(strongestBand ? { band: strongestBand } : {}),
      ...(tag ? { tag } : {})
    });
  }

  return result;
}

function ruleMatches(match, item) {
  if (!containsAny(item.slug, match.slugContains)) {
    return false;
  }

  if (!containsAny(item.fullName ?? '', match.fullNameContains)) {
    return false;
  }

  if (!containsAny(item.title, match.titleContains)) {
    return false;
  }

  if (!matchesAny(item.tags, match.tagsAny)) {
    return false;
  }

  if (!matchesAny([item.type], match.type)) {
    return false;
  }

  if (!matchesAny([item.state], match.state)) {
    return false;
  }

  if (!matchesAny([item.category], match.category)) {
    return false;
  }

  if (!matchesAny([item.strategy], match.strategy)) {
    return false;
  }

  return true;
}

function containsAny(value, needles) {
  if (needles.length === 0) {
    return true;
  }

  const haystack = String(value ?? '').toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

function matchesAny(values, allowed) {
  if (allowed.length === 0) {
    return true;
  }

  const normalized = values
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter((value) => value.length > 0);

  return normalized.some((value) => allowed.includes(value));
}

function collectItemTags(item) {
  const allTags = [];

  if (Array.isArray(item?.tags)) {
    allTags.push(...item.tags);
  }

  if (Array.isArray(item?.topics)) {
    allTags.push(...item.topics);
  }

  const unique = new Set();
  for (const tag of allTags) {
    const normalized = String(tag ?? '').trim().toLowerCase();
    if (normalized.length > 0) {
      unique.add(normalized);
    }
  }

  return Array.from(unique).sort((left, right) => left.localeCompare(right));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? '').trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function normalizeOptionalString(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function normalizeBand(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return Object.hasOwn(BAND_STRENGTH, normalized) ? normalized : null;
}

function isStrongerBand(leftBand, rightBand) {
  const left = normalizeBand(leftBand);
  const right = normalizeBand(rightBand);

  if (!left) {
    return false;
  }

  if (!right) {
    return true;
  }

  return BAND_STRENGTH[left] > BAND_STRENGTH[right];
}

function formatSignedNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '+0';
  }

  if (number >= 0) {
    return `+${number}`;
  }

  return String(number);
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

function inferEffortEstimate(sizeKb, completionLevel) {
  if (!Number.isFinite(sizeKb) || sizeKb < 0) {
    throw new Error('Invalid sizeKb for effort inference');
  }

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
