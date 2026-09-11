import {
  hasSessionAvailableForActiveLesson,
  isSessionAvailableForActiveLesson,
} from "./attemptRegistry.generated";
import { isCategoryUnlocked } from "./mastery";
import type { ExerciseBlueprint, ExerciseCategory, LearnerState } from "./types";

export function isCategoryAvailableForActiveLesson(
  category: ExerciseCategory,
  state: LearnerState,
): boolean {
  return isCategoryUnlocked(category, state) && hasSessionAvailableForActiveLesson(category);
}

export function nextSessionId(
  blueprint: ExerciseBlueprint,
  completedSessionIds: string[]
): string {
  const completed = new Set(completedSessionIds);
  const available = blueprint.sessions.filter((session) =>
    isSessionAvailableForActiveLesson(blueprint.category, session.id)
  );

  return (
    available.find((session) => !completed.has(session.id))?.id ??
    available[0]?.id ??
    ""
  );
}
