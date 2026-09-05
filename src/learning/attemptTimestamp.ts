export const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function isCanonicalAttemptTimestamp(value: unknown, latestAllowedMs: number): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || !Number.isFinite(latestAllowedMs) || timestamp > latestAllowedMs) return false;
  return new Date(timestamp).toISOString() === value;
}
