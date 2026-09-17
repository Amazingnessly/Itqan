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
  learningStage,
  type LearningStageId,
} from "./categoryCatalog";
import { chronologicalAttempts } from "./attemptOrder";
import {
  isCategoryUnlocked,
  isLearningStageUnlocked,
  isLearningStageUnlockedFromAttempts,
} from "./mastery";
import type { AttemptRecord, ExerciseBlueprint, ExerciseCategory, LearnerState } from "./types";

export type IncompleteLessonTarget = {
  category: ExerciseCategory;
  sessionId: string;
};

export function availableSessionIdsForLearningStage(stageId: LearningStageId): string[] {
  const stage = learningStage(stageId);
  const active = availableSessionIdsForActiveLesson(stage.category);
  if (!stage.sessionIds) return active;
  const allowed = new Set<string>(stage.sessionIds);
  return active.filter((sessionId) => allowed.has(sessionId));
}

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

export function isLearningStageAvailableForActiveLesson(
  stageId: LearningStageId,
  state: LearnerState,
): boolean {
  return isLearningStageUnlocked(stageId, state)
    && availableSessionIdsForLearningStage(stageId).length > 0;
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

function mostRecentIncompleteFromSessionIds(
  category: ExerciseCategory,
  sessionIds: readonly string[],
  attempts: AttemptRecord[],
): IncompleteLessonTarget | undefined {
  let target: IncompleteLessonTarget | undefined;
  let targetOrder = -1;
  for (const sessionId of sessionIds) {
    const order = incompleteSessionOrder(category, sessionId, attempts);
    if (order !== null && order > targetOrder) {
      target = { category, sessionId };
      targetOrder = order;
    }
  }
  return target;
}

export function mostRecentIncompleteLessonTarget(
  categories: readonly ExerciseCategory[],
  attempts: AttemptRecord[],
): IncompleteLessonTarget | undefined {
  let target: IncompleteLessonTarget | undefined;
  let targetOrder = -1;
  for (const category of categories) {
    const candidate = mostRecentIncompleteFromSessionIds(
      category,
      availableSessionIdsForCurrentLearningStage(category, attempts),
      attempts,
    );
    if (!candidate) continue;
    const order = incompleteSessionOrder(category, candidate.sessionId, attempts);
    if (order !== null && order > targetOrder) {
      target = candidate;
      targetOrder = order;
    }
  }
  return target;
}

export function mostRecentIncompleteSessionId(
  category: ExerciseCategory,
  attempts: AttemptRecord[],
  stageId?: LearningStageId,
): string | undefined {
  const sessionIds = stageId
    ? availableSessionIdsForLearningStage(stageId)
    : availableSessionIdsForCurrentLearningStage(category, attempts);
  return mostRecentIncompleteFromSessionIds(category, sessionIds, attempts)?.sessionId;
}

export function nextSessionId(
  blueprint: ExerciseBlueprint,
  attempts: AttemptRecord[],
  stageId?: LearningStageId,
): string {
  if (stageId && learningStage(stageId).category !== blueprint.category) return "";

  const stageSessionIds = new Set(
    stageId
      ? availableSessionIdsForLearningStage(stageId)
      : availableSessionIdsForCurrentLearningStage(blueprint.category, attempts),
  );
  const available = blueprint.sessions.filter((session) =>
    stageSessionIds.has(session.id)
    && isSessionAvailableForActiveLesson(blueprint.category, session.id)
  );
  if (!available.length) return "";

  const activeSession = mostRecentIncompleteSessionId(blueprint.category, attempts, stageId);
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
