import {
  completedSessionIdsFromAuthorizedAttempts,
  sessionResumeIndexFromAuthorizedAttempts,
} from "./attemptRegistry.generated";
import { loadLearnerState } from "./persistence";
import type { ExerciseCategory } from "./types";

export function loadCompletedSessionIds(): string[] {
  return completedSessionIdsFromAuthorizedAttempts(loadLearnerState().attempts);
}

export function loadSessionResumeIndex(category: ExerciseCategory, sessionId: string): number {
  return sessionResumeIndexFromAuthorizedAttempts(category, sessionId, loadLearnerState().attempts);
}

export function markSessionCompleted(_sessionId: string): string[] {
  return loadCompletedSessionIds();
}
