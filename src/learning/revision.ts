import type { ExerciseCategory, LearnerState, MasteryLevel } from "./types";

const LEVEL_WEIGHT: Record<MasteryLevel, number> = { discovery: 5, progression: 4, consolidation: 3, mastery: 2, excellence: 1 };

export type RevisionPriority = { category: ExerciseCategory; score: number; reason: "recent_errors" | "review_due" | "low_stability" | "maintenance" };

export function rankRevisionPriorities(state: LearnerState): RevisionPriority[] {
  return Object.values(state.skills).map((skill) => {
    const recent = state.attempts.filter((a) => a.category === skill.category).slice(-12);
    const errors = recent.filter((a) => a.outcome === "incorrect").length;
    let score = LEVEL_WEIGHT[skill.level] * 10 + errors * 8;
    let reason: RevisionPriority["reason"] = "maintenance";
    if (errors >= 2) { reason = "recent_errors"; score += 25; }
    else if (!skill.stableAcrossContexts) { reason = "low_stability"; score += 12; }
    return { category: skill.category, score, reason };
  }).sort((a,b) => b.score - a.score);
}
