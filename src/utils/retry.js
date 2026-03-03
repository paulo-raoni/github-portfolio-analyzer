const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 30_000;

export function isRetryableStatus(status) {
  return status === 403 || status === 429 || status >= 500;
}

export function computeRetryDelayMs({ responseHeaders, attempt, nowMs = Date.now() }) {
  const retryAfter = parseRetryAfterMs(responseHeaders);
  if (retryAfter !== null) {
    return retryAfter;
  }

  const resetDelay = parseRateLimitResetMs(responseHeaders, nowMs);
  if (resetDelay !== null) {
    return resetDelay;
  }

  const exponential = DEFAULT_BASE_DELAY_MS * (2 ** attempt);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(DEFAULT_MAX_DELAY_MS, exponential + jitter);
}

export async function sleepMs(delayMs) {
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function parseRetryAfterMs(headers) {
  if (!headers) {
    return null;
  }

  const retryAfterRaw = headers.get('retry-after');
  if (!retryAfterRaw) {
    return null;
  }

  const seconds = Number.parseInt(retryAfterRaw, 10);
  if (Number.isNaN(seconds) || seconds < 0) {
    return null;
  }

  return seconds * 1000;
}

function parseRateLimitResetMs(headers, nowMs) {
  if (!headers) {
    return null;
  }

  const resetRaw = headers.get('x-ratelimit-reset');
  if (!resetRaw) {
    return null;
  }

  const secondsSinceEpoch = Number.parseInt(resetRaw, 10);
  if (Number.isNaN(secondsSinceEpoch)) {
    return null;
  }

  const resetTimeMs = secondsSinceEpoch * 1000;
  return Math.max(0, resetTimeMs - nowMs);
}
