const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function classifyActivity(pushedAt, asOfDate) {
  const ageDays = daysSince(pushedAt, asOfDate);

  if (ageDays <= 90) {
    return 'active';
  }

  if (ageDays <= 365) {
    return 'stale';
  }

  return 'abandoned';
}

export function classifyMaturity(sizeKb) {
  if (sizeKb < 500) {
    return 'experimental';
  }

  if (sizeKb <= 5000) {
    return 'early';
  }

  if (sizeKb <= 50000) {
    return 'structured';
  }

  return 'large';
}

export function daysSince(dateInput, asOfDate) {
  const source = new Date(dateInput);
  const reference = new Date(`${asOfDate}T00:00:00.000Z`);

  if (Number.isNaN(source.getTime()) || Number.isNaN(reference.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  const diffMs = reference.getTime() - source.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  return Math.floor(diffMs / DAY_IN_MS);
}
