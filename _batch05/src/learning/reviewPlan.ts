import { rankRevisionPriorities } from "./revision";
import { CATEGORY_LABELS, recentErrors } from "./progressInsights";
import type { ExerciseCategory, LearnerState } from "./types";

export type ReviewPlan = {
  category: ExerciseCategory;
  title: string;
  reason: string;
  errorCount: number;
  dueNow: boolean;
};

const ACTIVE_REVIEW_CATEGORIES: ExerciseCategory[] = ["reading_units"];

export function buildReviewPlan(
  state: LearnerState,
  now = new Date()
): ReviewPlan {
  const ranked = rankRevisionPriorities(state, now).filter((entry) =>
    ACTIVE_REVIEW_CATEGORIES.includes(entry.category)
  );

  const selected = ranked[0] ?? {
    category: "reading_units" as const,
    reason: "maintenance" as const,
    score: 0,
  };

  const skill = state.skills[selected.category];
  const dueNow = skill.nextReviewAt
    ? Date.parse(skill.nextReviewAt) <= now.getTime()
    : true;

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
  };
}
