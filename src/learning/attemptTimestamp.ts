import type { AttemptRecord } from "./types";

export const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function isCanonicalAttemptTimestamp(value: unknown, latestAllowedMs: number): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || !Number.isFinite(latestAllowedMs) || timestamp > latestAllowedMs) return false;
  return new Date(timestamp).toISOString() === value;
}

export function isAttemptTimestampAtOrAfterHistory(
  value: string,
  attempts: readonly Pick<AttemptRecord, "attemptedAt">[],
): boolean {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;

  let latest = Number.NEGATIVE_INFINITY;
  for (const attempt of attempts) {
    const prior = Date.parse(attempt.attemptedAt);
    if (!Number.isFinite(prior)) return false;
    if (prior > latest) latest = prior;
  }
  return timestamp >= latest;
}
