const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function utcTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function resolveAsOfDate(input) {
  if (typeof input === 'string' && input.length > 0) {
    if (!ISO_DATE_PATTERN.test(input)) {
      throw new Error(`Invalid --as-of value: ${input}. Expected YYYY-MM-DD.`);
    }

    const asDate = new Date(`${input}T00:00:00.000Z`);
    if (Number.isNaN(asDate.getTime())) {
      throw new Error(`Invalid --as-of value: ${input}. Expected YYYY-MM-DD.`);
    }

    return input;
  }

  return utcTodayDateString();
}

export function utcNowISOString() {
  return new Date().toISOString();
}
