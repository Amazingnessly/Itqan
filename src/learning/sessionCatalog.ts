import { isSessionAvailableForActiveLesson } from "./attemptRegistry.generated";
import type { ExerciseBlueprint } from "./types";

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
