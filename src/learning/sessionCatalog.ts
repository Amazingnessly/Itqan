import type { AttemptRecord, ExerciseBlueprint } from "./types";

export function completedSessionIdsFromAttempts(
  blueprint: ExerciseBlueprint,
  attempts: AttemptRecord[]
): string[] {
  return blueprint.sessions
    .filter((session) => {
      const required = new Map<string, number>();
      for (const interaction of session.interactions) {
        required.set(interaction.itemId, (required.get(interaction.itemId) ?? 0) + 1);
      }

      const correctCounts = new Map<string, number>();
      for (const attempt of attempts) {
        if (
          attempt.category !== blueprint.category
          || attempt.sessionId !== session.id
          || attempt.outcome !== "correct"
        ) continue;
        correctCounts.set(attempt.itemId, (correctCounts.get(attempt.itemId) ?? 0) + 1);
      }

      return Array.from(required.entries()).every(
        ([itemId, count]) => (correctCounts.get(itemId) ?? 0) >= count
      );
    })
    .map((session) => session.id);
}

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
