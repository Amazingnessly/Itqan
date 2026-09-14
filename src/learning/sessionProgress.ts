import {
  completedSessionIdsFromAuthorizedAttempts,
  sessionResumeIndexFromAuthorizedAttempts,
} from "./attemptRegistry.generated";
import { chronologicalAttempts } from "./attemptOrder";
import { loadLearnerState } from "./persistence";
import type { AttemptRecord, ExerciseCategory } from "./types";

export function currentIncompleteSessionRetryCount(
  attempts: AttemptRecord[],
  category: ExerciseCategory,
  sessionId: string,
  interactionCount: number,
): number {
  if (!Number.isInteger(interactionCount) || interactionCount <= 0) return 0;

  let correctInCycle = 0;
  let retriesInCycle = 0;
  for (const attempt of chronologicalAttempts(attempts)) {
    if (attempt.category !== category || attempt.sessionId !== sessionId) continue;
    if (attempt.outcome === "incorrect") {
      retriesInCycle += 1;
      continue;
    }
    if (attempt.outcome !== "correct") continue;

    correctInCycle += 1;
    if (correctInCycle >= interactionCount) {
      correctInCycle = 0;
      retriesInCycle = 0;
    }
  }
  return retriesInCycle;
}

export function loadCompletedSessionIds(): string[] {
  return completedSessionIdsFromAuthorizedAttempts(loadLearnerState().attempts);
}

export function loadSessionResumeIndex(category: ExerciseCategory, sessionId: string): number {
  return sessionResumeIndexFromAuthorizedAttempts(category, sessionId, loadLearnerState().attempts);
}

export function loadSessionRetryCount(
  category: ExerciseCategory,
  sessionId: string,
  interactionCount: number,
): number {
  return currentIncompleteSessionRetryCount(
    loadLearnerState().attempts,
    category,
    sessionId,
    interactionCount,
  );
}

export function markSessionCompleted(_sessionId: string): string[] {
  return loadCompletedSessionIds();
}
