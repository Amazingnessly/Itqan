import { chronologicalAttempts } from "./attemptOrder";
import {
  hasSessionAvailableForActiveLesson,
  isSessionAvailableForActiveLesson,
} from "./attemptRegistry.generated";
import { isCategoryUnlocked } from "./mastery";
import { rankRevisionPriorities } from "./revision";
import { CATEGORY_LABELS, recentErrors, recentUnresolvedErrorAttempts } from "./progressInsights";
import type { ExerciseCategory, LearnerState } from "./types";

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
    return [...relevant].reverse().find((attempt) => attempt.outcome === "correct")?.sessionId;
  }
  return undefined;
}

export function buildReviewPlan(state: LearnerState, now = new Date()): ReviewPlan {
  const ranked = rankRevisionPriorities(state, now).filter(
    (priority) =>
      isCategoryUnlocked(priority.category, state) &&
      hasSessionAvailableForActiveLesson(priority.category),
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
          ? "La compétence doit encore tenir dans plusieurs contextes."
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
