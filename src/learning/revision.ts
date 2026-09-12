import { recentErrors } from "./progressInsights";
import type { ExerciseCategory, LearnerState, MasteryLevel } from "./types";

const LEVEL_WEIGHT: Record<MasteryLevel, number> = { discovery: 5, progression: 4, consolidation: 3, mastery: 2, excellence: 1 };
const REASON_WEIGHT: Record<RevisionPriority["reason"], number> = { recent_errors: 4, review_due: 3, low_stability: 2, maintenance: 1 };

export type RevisionPriority = { category: ExerciseCategory; score: number; reason: "recent_errors" | "review_due" | "low_stability" | "maintenance" };

function lastPracticedTime(state: LearnerState, category: ExerciseCategory): number {
  const timestamp = state.skills[category].lastPracticedAt;
  if (!timestamp) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function rankRevisionPriorities(state: LearnerState, now = new Date()): RevisionPriority[] {
  return Object.values(state.skills).map((skill) => {
    const errors = recentErrors(state, skill.category, 12);
    const reviewDue = skill.nextReviewAt ? Date.parse(skill.nextReviewAt) <= now.getTime() : false;
    let score = LEVEL_WEIGHT[skill.level] * 10 + errors * 8;
    let reason: RevisionPriority["reason"] = "maintenance";
    if (errors >= 2) { reason = "recent_errors"; score += 25; }
    else if (reviewDue) { reason = "review_due"; score += 20; }
    else if (!skill.stableAcrossContexts) { reason = "low_stability"; score += 12; }
    return { category: skill.category, score, reason };
  }).sort((a,b) => {
    const reasonDelta = REASON_WEIGHT[b.reason] - REASON_WEIGHT[a.reason];
    if (reasonDelta) return reasonDelta;
    const scoreDelta = b.score - a.score;
    if (scoreDelta) return scoreDelta;
    if (a.reason === "maintenance" && b.reason === "maintenance") {
      return lastPracticedTime(state, a.category) - lastPracticedTime(state, b.category);
    }
    return 0;
  });
}
