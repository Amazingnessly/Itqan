import {
  hasSessionAvailableForActiveLesson,
  isAttemptAuthorizedByControlledBlueprint,
  isSessionAvailableForActiveLesson,
  sessionCompletionCountFromAuthorizedAttempts,
  sessionResumeIndexFromAuthorizedAttempts,
} from "./attemptRegistry.generated";
import { chronologicalAttempts } from "./attemptOrder";
import { isCategoryUnlocked } from "./mastery";
import type { AttemptRecord, ExerciseBlueprint, ExerciseCategory, LearnerState } from "./types";

export function isCategoryAvailableForActiveLesson(
  category: ExerciseCategory,
  state: LearnerState,
): boolean {
  return isCategoryUnlocked(category, state) && hasSessionAvailableForActiveLesson(category);
}

function incompleteSessionRecency(
  category: ExerciseCategory,
  sessionId: string,
  attempts: AttemptRecord[],
): number | null {
  const relevant = chronologicalAttempts(
    attempts.filter((attempt) =>
      attempt.category === category
      && attempt.sessionId === sessionId
      && isAttemptAuthorizedByControlledBlueprint(attempt)
    )
  );
  const latest = relevant.at(-1);
  if (!latest) return null;

  const resumeIndex = sessionResumeIndexFromAuthorizedAttempts(category, sessionId, attempts);
  if (resumeIndex === 0 && latest.outcome === "correct") return null;

  const attemptedAt = Date.parse(latest.attemptedAt);
  return Number.isFinite(attemptedAt) ? attemptedAt : null;
}

export function nextSessionId(
  blueprint: ExerciseBlueprint,
  attempts: AttemptRecord[],
): string {
  const available = blueprint.sessions.filter((session) =>
    isSessionAvailableForActiveLesson(blueprint.category, session.id)
  );
  if (!available.length) return "";

  let activeSession = "";
  let activeSessionAt = -Infinity;
  for (const session of available) {
    const recency = incompleteSessionRecency(blueprint.category, session.id, attempts);
    if (recency !== null && recency > activeSessionAt) {
      activeSession = session.id;
      activeSessionAt = recency;
    }
  }
  if (activeSession) return activeSession;

  let selected = available[0];
  let selectedCycles = sessionCompletionCountFromAuthorizedAttempts(
    blueprint.category,
    selected.id,
    attempts,
  );
  for (const session of available.slice(1)) {
    const cycles = sessionCompletionCountFromAuthorizedAttempts(
      blueprint.category,
      session.id,
      attempts,
    );
    if (cycles < selectedCycles) {
      selected = session;
      selectedCycles = cycles;
    }
  }
  return selected.id;
}
