import {
  hasSessionAvailableForActiveLesson,
  isSessionAvailableForActiveLesson,
  sessionCompletionCountFromAuthorizedAttempts,
} from "./attemptRegistry.generated";
import { isCategoryUnlocked } from "./mastery";
import type { AttemptRecord, ExerciseBlueprint, ExerciseCategory, LearnerState } from "./types";

export function isCategoryAvailableForActiveLesson(
  category: ExerciseCategory,
  state: LearnerState,
): boolean {
  return isCategoryUnlocked(category, state) && hasSessionAvailableForActiveLesson(category);
}

export function nextSessionId(
  blueprint: ExerciseBlueprint,
  attempts: AttemptRecord[],
): string {
  const available = blueprint.sessions.filter((session) =>
    isSessionAvailableForActiveLesson(blueprint.category, session.id)
  );
  if (!available.length) return "";

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
