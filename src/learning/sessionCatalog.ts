import type { ExerciseBlueprint } from "./types";

export function nextSessionId(
  blueprint: ExerciseBlueprint,
  completedSessionIds: string[]
): string {
  const completed = new Set(completedSessionIds);

  return (
    blueprint.sessions.find((session) => !completed.has(session.id))?.id ??
    blueprint.sessions[0]?.id ??
    ""
  );
}
