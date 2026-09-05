const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function isCanonicalAttemptTimestamp(value: string, nowMs = Date.now()): boolean {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || !Number.isFinite(nowMs)) return false;
  if (timestamp > nowMs + MAX_FUTURE_CLOCK_SKEW_MS) return false;
  return new Date(timestamp).toISOString() === value;
}
