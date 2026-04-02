import { daysSince } from './classification.js';

const CATEGORY_WEIGHTS = {
  product: {
    pushedWithin90Days: 25, hasReadme: 15, hasLicense: 10,
    hasTests: 25, starsOverOne: 5, updatedWithin180Days: 20, baseline: 0
  },
  tooling: {
    pushedWithin90Days: 25, hasReadme: 15, hasLicense: 10,
    hasTests: 20, starsOverOne: 5, updatedWithin180Days: 25, baseline: 0
  },
  library: {
    pushedWithin90Days: 20, hasReadme: 20, hasLicense: 20,
    hasTests: 25, starsOverOne: 10, updatedWithin180Days: 5, baseline: 0
  },
  content: {
    pushedWithin90Days: 25, hasReadme: 15, hasLicense: 0,
    hasTests: 0, starsOverOne: 5, updatedWithin180Days: 30, baseline: 25
  },
  learning: {
    pushedWithin90Days: 20, hasReadme: 15, hasLicense: 0,
    hasTests: 0, starsOverOne: 5, updatedWithin180Days: 25, baseline: 35
  },
  infra: {
    pushedWithin90Days: 25, hasReadme: 20, hasLicense: 10,
    hasTests: 10, starsOverOne: 5, updatedWithin180Days: 30, baseline: 0
  },
  experiment: {
    pushedWithin90Days: 20, hasReadme: 15, hasLicense: 0,
    hasTests: 0, starsOverOne: 5, updatedWithin180Days: 15, baseline: 45
  },
  template: {
    pushedWithin90Days: 10, hasReadme: 25, hasLicense: 10,
    hasTests: 5, starsOverOne: 10, updatedWithin180Days: 10, baseline: 30
  }
};

const DEFAULT_WEIGHTS = CATEGORY_WEIGHTS.tooling;

export function scoreRepository(repository, asOfDate) {
  const category = repository.category ?? 'tooling';
  const weights = CATEGORY_WEIGHTS[category] ?? DEFAULT_WEIGHTS;

  let score = weights.baseline ?? 0;
  const breakdown = {
    baseline: weights.baseline ?? 0,
    pushedWithin90Days: 0,
    hasReadme: 0,
    hasLicense: 0,
    hasTests: 0,
    starsOverOne: 0,
    updatedWithin180Days: 0
  };

  if (weights.pushedWithin90Days > 0 && daysSince(repository.pushedAt, asOfDate) <= 90) {
    score += weights.pushedWithin90Days;
    breakdown.pushedWithin90Days = weights.pushedWithin90Days;
  }

  if (weights.hasReadme > 0 && repository.structuralHealth?.hasReadme) {
    score += weights.hasReadme;
    breakdown.hasReadme = weights.hasReadme;
  }

  if (weights.hasLicense > 0 && repository.structuralHealth?.hasLicense) {
    score += weights.hasLicense;
    breakdown.hasLicense = weights.hasLicense;
  }

  if (weights.hasTests > 0 && repository.structuralHealth?.hasTests) {
    score += weights.hasTests;
    breakdown.hasTests = weights.hasTests;
  }

  if (weights.starsOverOne > 0 && (repository.stargazersCount ?? 0) > 1) {
    score += weights.starsOverOne;
    breakdown.starsOverOne = weights.starsOverOne;
  }

  if (weights.updatedWithin180Days > 0 && daysSince(repository.updatedAt, asOfDate) <= 180) {
    score += weights.updatedWithin180Days;
    breakdown.updatedWithin180Days = weights.updatedWithin180Days;
  }

  return {
    score: clamp(score, 0, 100),
    scoreBreakdown: breakdown
  };
}

export function scoreIdea(idea) {
  let score = 30;
  const breakdown = {
    baseline: 30,
    scopeOrProblem: 0,
    targetUser: 0,
    mvp: 0,
    nextAction: 0
  };

  if (hasText(idea.scope) || hasText(idea.problem)) {
    score += 20;
    breakdown.scopeOrProblem = 20;
  }

  if (hasText(idea.targetUser)) {
    score += 15;
    breakdown.targetUser = 15;
  }

  if (hasText(idea.mvp)) {
    score += 15;
    breakdown.mvp = 15;
  }

  if (hasText(idea.nextAction)) {
    score += 20;
    breakdown.nextAction = 20;
  }

  return {
    score: clamp(score, 0, 100),
    scoreBreakdown: breakdown
  };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
