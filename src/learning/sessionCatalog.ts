import {
  availableSessionIdsForActiveLesson,
  isAttemptAuthorizedByControlledBlueprint,
  isSessionAvailableForActiveLesson,
  sessionCompletionCountFromAuthorizedAttempts,
  sessionResumeIndexFromAuthorizedAttempts,
} from "./attemptRegistry.generated";
import {
  ARTICLE_QAMARIYYAH_SESSION_IDS,
  ARTICLE_SHAMSIYYAH_SESSION_IDS,
} from "./categoryCatalog";
import { chronologicalAttempts } from "./attemptOrder";
import {
  isCategoryUnlocked,
  isLearningStageUnlockedFromAttempts,
} from "./mastery";
import type { AttemptRecord, ExerciseBlueprint, ExerciseCategory, LearnerState } from "./types";

export type IncompleteLessonTarget = {
  category: ExerciseCategory;
  sessionId: string;
};

export function availableSessionIdsForCurrentLearningStage(
  category: ExerciseCategory,
  attempts: AttemptRecord[],
): string[] {
  const active = availableSessionIdsForActiveLesson(category);
  if (category !== "article_al") return active;

  const stageIds = isLearningStageUnlockedFromAttempts("article_shamsiyyah", attempts)
    ? ARTICLE_SHAMSIYYAH_SESSION_IDS
    : ARTICLE_QAMARIYYAH_SESSION_IDS;
  const allowed = new Set<string>(stageIds);
  return active.filter((sessionId) => allowed.has(sessionId));
}

export function isCategoryAvailableForActiveLesson(
  category: ExerciseCategory,
  state: LearnerState,
): boolean {
  return isCategoryUnlocked(category, state)
    && availableSessionIdsForCurrentLearningStage(category, state.attempts).length > 0;
}

function incompleteSessionOrder(
  category: ExerciseCategory,
  sessionId: string,
  attempts: AttemptRecord[],
): number | null {
  const resumeIndex = sessionResumeIndexFromAuthorizedAttempts(category, sessionId, attempts);
  const chronological = chronologicalAttempts(attempts);
  for (let index = chronological.length - 1; index >= 0; index -= 1) {
    const attempt = chronological[index];
    if (
      attempt.category !== category
      || attempt.sessionId !== sessionId
      || !isAttemptAuthorizedByControlledBlueprint(attempt)
    ) continue;
    if (resumeIndex === 0 && attempt.outcome === "correct") return null;
    return index;
  }
  return null;
}

export function mostRecentIncompleteLessonTarget(
  categories: readonly ExerciseCategory[],
  attempts: AttemptRecord[],
): IncompleteLessonTarget | undefined {
  let target: IncompleteLessonTarget | undefined;
  let targetOrder = -1;
  for (const category of categories) {
    for (const sessionId of availableSessionIdsForCurrentLearningStage(category, attempts)) {
      const order = incompleteSessionOrder(category, sessionId, attempts);
      if (order !== null && order > targetOrder) {
        target = { category, sessionId };
        targetOrder = order;
      }
    }
  }
  return target;
}

export function mostRecentIncompleteSessionId(
  category: ExerciseCategory,
  attempts: AttemptRecord[],
): string | undefined {
  return mostRecentIncompleteLessonTarget([category], attempts)?.sessionId;
}

export function nextSessionId(
  blueprint: ExerciseBlueprint,
  attempts: AttemptRecord[],
): string {
  const stageSessionIds = new Set(
    availableSessionIdsForCurrentLearningStage(blueprint.category, attempts),
  );
  const available = blueprint.sessions.filter((session) =>
    stageSessionIds.has(session.id)
    && isSessionAvailableForActiveLesson(blueprint.category, session.id)
  );
  if (!available.length) return "";

  const activeSession = mostRecentIncompleteSessionId(blueprint.category, attempts);
  if (activeSession && available.some((session) => session.id === activeSession)) return activeSession;

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
