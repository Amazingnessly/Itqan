import type { AttemptRecord } from "./types";

export function chronologicalAttempts(attempts: AttemptRecord[]): AttemptRecord[] {
  return attempts
    .map((attempt, index) => ({
      attempt,
      index,
      timestamp: Date.parse(attempt.attemptedAt),
    }))
    .sort((a, b) => a.timestamp - b.timestamp || a.index - b.index)
    .map(({ attempt }) => attempt);
}
