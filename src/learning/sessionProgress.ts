import { completedSessionIdsFromAuthorizedAttempts } from "./attemptRegistry.generated";
import { loadLearnerState } from "./persistence";

export function loadCompletedSessionIds(): string[] {
  return completedSessionIdsFromAuthorizedAttempts(loadLearnerState().attempts);
}

export function markSessionCompleted(_sessionId: string): string[] {
  return loadCompletedSessionIds();
}
