import { formatNextAction, normalizeNextAction } from '../utils/nextAction.js';

function inferRepoCategory(repository) {
  const name = String(repository.name ?? '').toLowerCase();
  const desc = String(repository.description ?? '').toLowerCase();
  const topics = Array.isArray(repository.topics)
    ? repository.topics.map((topic) => String(topic).toLowerCase())
    : [];
  const all = [name, desc, ...topics].join(' ');

  if (/\b(prompt|note|notes|snippet|snippets|cheatsheet|doc|docs|documentation|knowledge|wiki|resource|resources|writing|content|guide|guides|cookbook)\b/.test(all)) {
    return 'content';
  }

  if (/\b(learn|learning|study|exercise|exercises|course|tutorial|tutorials|practice|training|bootcamp|challenge|challenges|kata|class|classes|introduction|intro|essencial|essential|material|curriculum|syllabus|principles)\b/.test(all)) {
    return 'learning';
  }

  if (/\b(template|templates|boilerplate|starter|scaffold|skeleton|seed|base|init)\b/.test(all)) {
    return 'template';
  }

  if (/\b(poc|proof|experiment|spike|demo|prototype|sandbox|playground|try|trying)\b/.test(all)) {
    return 'experiment';
  }

  if (/\b(lib|library|sdk|package|npm|module|plugin|extension|addon|util|utils|helper|helpers)\b/.test(all)) {
    return 'library';
  }

  if (/\b(infra|infrastructure|docker|kubernetes|k8s|ci|cd|pipeline|deploy|devops|ansible|terraform|nginx|proxy)\b/.test(all)) {
    return 'infra';
  }

  if (/\b(app|application|system|platform|service|api|backend|frontend|web|mobile|dashboard|portal|saas|clock|calculator|game|games|viewer|weather|timer|todo|player|tracker)\b/.test(all)) {
    return 'product';
  }

  return 'tooling';
}

export function buildRepoTaxonomy(repository) {
  const activityState = repository.activity;
  const state = repository.archived ? 'archived' : normalizeState(activityState, 'active');

  const userCategory = normalizeCategory(repository.category);
  const category = userCategory ?? inferRepoCategory(repository);
  const strategy = 'maintenance';
  const effort = 'm';
  const value = 'medium';
  const nextAction = defaultRepoNextAction(state);

  const sources = {
    category: userCategory ? 'user' : 'inferred',
    state: repository.archived ? 'inferred' : 'inferred',
    strategy: 'default',
    effort: 'default',
    value: 'default',
    nextAction: 'default'
  };

  return {
    type: 'repo',
    category,
    state,
    strategy,
    effort,
    value,
    nextAction: normalizeNextAction(nextAction),
    taxonomyMeta: {
      defaulted: Object.values(sources).includes('default'),
      sources,
      inferenceSignals: repository.archived ? ['repository.archived=true'] : ['activity classification']
    }
  };
}

export function buildIdeaTaxonomy(idea) {
  const inferredState = mapIdeaStatusToState(idea.status);

  const category = normalizeCategory(idea.category) ?? 'experiment';
  const state = normalizeState(idea.state, inferredState);
  const strategy = normalizeStrategy(idea.strategy) ?? 'parked';
  const effort = normalizeEffort(idea.effort) ?? 'm';
  const value = normalizeValue(idea.value) ?? 'medium';
  const nextAction = normalizeNextAction(
    typeof idea.nextAction === 'string' && idea.nextAction.trim().length > 0
      ? idea.nextAction
      : formatNextAction('Define', 'MVP in 7 bullets', 'issue includes scope, target user, and acceptance checks')
  );

  const sources = {
    category: normalizeCategory(idea.category) ? 'user' : 'default',
    state: normalizeState(idea.state, null) ? 'user' : 'inferred',
    strategy: normalizeStrategy(idea.strategy) ? 'user' : 'default',
    effort: normalizeEffort(idea.effort) ? 'user' : 'default',
    value: normalizeValue(idea.value) ? 'user' : 'default',
    nextAction: typeof idea.nextAction === 'string' && idea.nextAction.trim().length > 0 ? 'user' : 'default'
  };

  const inferenceSignals = [];
  if (sources.state === 'inferred') {
    inferenceSignals.push('status mapping');
  }

  return {
    type: 'idea',
    category,
    state,
    strategy,
    effort,
    value,
    nextAction,
    taxonomyMeta: {
      defaulted: Object.values(sources).includes('default'),
      sources,
      ...(inferenceSignals.length > 0 ? { inferenceSignals } : {})
    }
  };
}

export function mapIdeaStatusToState(status) {
  const value = String(status ?? '').trim().toLowerCase();

  if (value === 'active' || value === 'in-progress') {
    return 'active';
  }

  if (value === 'stale' || value === 'on-hold') {
    return 'stale';
  }

  if (value === 'abandoned' || value === 'dropped' || value === 'dormant') {
    return 'dormant';
  }

  if (value === 'archived') {
    return 'archived';
  }

  if (value === 'reference-only' || value === 'reference') {
    return 'reference-only';
  }

  return 'idea';
}

function defaultRepoNextAction(state) {
  if (state === 'active') {
    return formatNextAction('Ship', 'one meaningful improvement', 'one PR with tests and updated docs is merged');
  }

  if (state === 'stale') {
    return formatNextAction('Refresh', 'execution documentation', 'README run steps are validated in a clean environment');
  }

  if (state === 'dormant' || state === 'abandoned') {
    return formatNextAction('Decide', 'retain or archive status', 'README contains a documented decision and rationale');
  }

  if (state === 'archived') {
    return formatNextAction('Document', 'reference usage', 'README states archive reason and replacement options');
  }

  return formatNextAction('Clarify', 'project direction', 'next milestone and owner are documented');
}

function normalizeCategory(value) {
  return normalizeEnum(value, ['product', 'tooling', 'library', 'learning', 'content', 'infra', 'experiment', 'template']);
}

function normalizeState(value, fallback) {
  return normalizeEnum(value, ['idea', 'active', 'stale', 'dormant', 'abandoned', 'archived', 'reference-only']) ?? fallback;
}

function normalizeStrategy(value) {
  return normalizeEnum(value, ['strategic-core', 'strategic-support', 'opportunistic', 'maintenance', 'parked']);
}

function normalizeEffort(value) {
  return normalizeEnum(value, ['xs', 's', 'm', 'l', 'xl']);
}

function normalizeValue(value) {
  return normalizeEnum(value, ['low', 'medium', 'high', 'very-high']);
}

function normalizeEnum(value, allowed) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return allowed.includes(normalized) ? normalized : null;
}
