export function formatNextAction(verb, target, measurableCondition) {
  return `${capitalize(verb)} ${target} — Done when: ${measurableCondition}`;
}

export function normalizeNextAction(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Invalid nextAction format. Required: "<Verb> <target> — Done when: <measurable condition>"');
  }

  const trimmed = value.trim();
  if (trimmed.includes('— Done when:')) {
    return trimmed;
  }

  if (trimmed.includes(' - Done when:')) {
    return trimmed.replace(' - Done when:', ' — Done when:');
  }

  throw new Error('Invalid nextAction format. Required: "<Verb> <target> — Done when: <measurable condition>"');
}

function capitalize(value) {
  if (value.length === 0) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}
