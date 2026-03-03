import { daysSince } from './classification.js';

export function scoreRepository(repository, asOfDate) {
  let score = 0;
  const breakdown = {
    pushedWithin90Days: 0,
    hasReadme: 0,
    hasLicense: 0,
    hasTests: 0,
    starsOverOne: 0,
    updatedWithin180Days: 0
  };

  if (daysSince(repository.pushedAt, asOfDate) <= 90) {
    score += 30;
    breakdown.pushedWithin90Days = 30;
  }

  if (repository.structuralHealth?.hasReadme) {
    score += 15;
    breakdown.hasReadme = 15;
  }

  if (repository.structuralHealth?.hasLicense) {
    score += 10;
    breakdown.hasLicense = 10;
  }

  if (repository.structuralHealth?.hasTests) {
    score += 20;
    breakdown.hasTests = 20;
  }

  if ((repository.stargazersCount ?? 0) > 1) {
    score += 5;
    breakdown.starsOverOne = 5;
  }

  if (daysSince(repository.updatedAt, asOfDate) <= 180) {
    score += 20;
    breakdown.updatedWithin180Days = 20;
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
