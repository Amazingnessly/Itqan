import { chronologicalAttempts } from "./attemptOrder";
import {
  availableSessionIdsForActiveLesson,
  isSessionAvailableForActiveLesson,
} from "./attemptRegistry.generated";
import { DEFAULT_MASTERY_POLICY } from "./mastery";
import { rankRevisionPriorities } from "./revision";
import { CATEGORY_LABELS, recentErrors, recentUnresolvedErrorAttempts } from "./progressInsights";
import { isCategoryAvailableForActiveLesson } from "./sessionCatalog";
import type { AttemptRecord, ExerciseCategory, LearnerState } from "./types";

export type ReviewPlan = {
  category: ExerciseCategory;
  title: string;
  reason: string;
  errorCount: number;
  dueNow: boolean;
  targetSessionId?: string;
};

function isActiveReviewSession(category: ExerciseCategory, sessionId: string): boolean {
  return isSessionAvailableForActiveLesson(category, sessionId);
}

function underrepresentedContextSession(
  category: ExerciseCategory,
  relevant: AttemptRecord[],
): string | undefined {
  const available = availableSessionIdsForActiveLesson(category);
  if (!available.length) return undefined;

  const evidence = new Map(
    available.map((sessionId, order) => [sessionId, { count: 0, lastCorrectIndex: -1, order }]),
  );
  const recentScored = relevant
    .filter((attempt) => attempt.outcome !== "skipped")
    .slice(-DEFAULT_MASTERY_POLICY.contextWindow);

  recentScored.forEach((attempt, index) => {
    if (attempt.outcome !== "correct") return;
    const stats = evidence.get(attempt.sessionId);
    if (!stats) return;
    stats.count += 1;
    stats.lastCorrectIndex = index;
  });

  return [...evidence.entries()]
    .sort(([, a], [, b]) =>
      a.count - b.count
      || a.lastCorrectIndex - b.lastCorrectIndex
      || a.order - b.order
    )[0]?.[0];
}

function targetSessionForReview(
  state: LearnerState,
  category: ExerciseCategory,
  reason: "recent_errors" | "review_due" | "low_stability" | "maintenance",
): string | undefined {
  const relevant = chronologicalAttempts(
    state.attempts.filter(
      (attempt) =>
        attempt.category === category && isActiveReviewSession(category, attempt.sessionId),
    ),
  );
  if (reason === "recent_errors") {
    return recentUnresolvedErrorAttempts(state, category)
      .filter((attempt) => isActiveReviewSession(category, attempt.sessionId))
      .at(-1)?.sessionId;
  }
  if (reason === "review_due") {
    return relevant.find((attempt) => attempt.outcome === "correct")?.sessionId;
  }
  if (reason === "low_stability") {
    return underrepresentedContextSession(category, relevant);
  }
  return undefined;
}

export function buildReviewPlan(state: LearnerState, now = new Date()): ReviewPlan {
  const ranked = rankRevisionPriorities(state, now).filter((priority) =>
    isCategoryAvailableForActiveLesson(priority.category, state)
  );

  const selected = ranked[0] ?? {
    category: "reading_units" as const,
    reason: "maintenance" as const,
    score: 0,
  };

  const skill = state.skills[selected.category];
  const dueNow = skill.nextReviewAt
    ? Date.parse(skill.nextReviewAt) <= now.getTime()
    : false;

  const reason =
    selected.reason === "recent_errors"
      ? "Des erreurs récentes demandent une reprise ciblée."
      : selected.reason === "review_due"
        ? "Le moment est venu de vérifier que la lecture reste stable."
        : selected.reason === "low_stability"
          ? "La précision doit encore se stabiliser dans les contextes récents."
          : "Une courte reprise entretient la précision acquise.";

  return {
    category: selected.category,
    title: CATEGORY_LABELS[selected.category],
    reason,
    errorCount: recentErrors(state, selected.category),
    dueNow,
    targetSessionId: targetSessionForReview(state, selected.category, selected.reason),
  };
}
