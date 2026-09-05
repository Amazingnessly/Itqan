import type { AttemptRecord, ExerciseCategory, LearnerState, MasteryLevel, SkillState } from "./types";

const CATEGORY_ORDER: ExerciseCategory[] = ["reading_units", "vowels_sukun", "shaddah", "article_al", "linking", "fluent_reading"];
const DELAYED_REVIEW_MS = 12 * 60 * 60 * 1000;

export const DEFAULT_MASTERY_POLICY = {
  recentWindow: 20,
  minimumAttemptsForProgression: 12,
  minimumAttemptsForConsolidation: 30,
  minimumAttemptsForMastery: 60,
  minimumAttemptsForExcellence: 100,
  progressionAccuracy: 0.90,
  consolidationAccuracy: 0.94,
  masteryAccuracy: 0.97,
  excellenceAccuracy: 0.985,
} as const;

export function createInitialLearnerState(): LearnerState {
  const skills = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, {
    category, level: "discovery", totalAttempts: 0, correctAttempts: 0,
    recentAccuracy: 0, delayedCheckPassed: false, stableAcrossContexts: false,
  } satisfies SkillState])) as LearnerState["skills"];
  return { version: 1, xp: 0, streakDays: 0, attempts: [], skills };
}

export function deriveXp(attempts: AttemptRecord[]): number {
  return attempts.reduce((total, attempt) => total + (attempt.outcome === "correct" ? 5 : 1), 0);
}

export function appendAttempt(state: LearnerState, attempt: AttemptRecord): LearnerState {
  const attempts = [...state.attempts, attempt];
  return { ...state, attempts, xp: deriveXp(attempts), skills: { ...state.skills, [attempt.category]: deriveSkillState(attempt.category, attempts) } };
}

export function deriveSkillState(category: ExerciseCategory, attempts: AttemptRecord[]): SkillState {
  const relevant = attempts.filter((a) => a.category === category);
  const scored = relevant.filter((a) => a.outcome !== "skipped");
  const correct = scored.filter((a) => a.outcome === "correct");
  const recent = scored.slice(-DEFAULT_MASTERY_POLICY.recentWindow);
  const recentAccuracy = recent.length ? recent.filter((a) => a.outcome === "correct").length / recent.length : 0;
  const stableAcrossContexts = new Set(correct.map((a) => a.sessionId)).size >= 3 && recent.length >= 12;
  const delayedCheckPassed = hasDelayedSuccess(relevant);
  const level = chooseLevel(scored.length, recentAccuracy, stableAcrossContexts, delayedCheckPassed);
  return {
    category, level, totalAttempts: scored.length,
    correctAttempts: correct.length,
    recentAccuracy, delayedCheckPassed, stableAcrossContexts,
    lastPracticedAt: relevant.at(-1)?.attemptedAt,
    nextReviewAt: deriveNextReviewAt(relevant, delayedCheckPassed),
  };
}

function chooseLevel(total: number, accuracy: number, stable: boolean, delayed: boolean): MasteryLevel {
  const p = DEFAULT_MASTERY_POLICY;
  if (total >= p.minimumAttemptsForExcellence && accuracy >= p.excellenceAccuracy && stable && delayed) return "excellence";
  if (total >= p.minimumAttemptsForMastery && accuracy >= p.masteryAccuracy && stable && delayed) return "mastery";
  if (total >= p.minimumAttemptsForConsolidation && accuracy >= p.consolidationAccuracy && stable) return "consolidation";
  if (total >= p.minimumAttemptsForProgression && accuracy >= p.progressionAccuracy) return "progression";
  return "discovery";
}

function successfulAttemptTimes(attempts: AttemptRecord[]): number[] {
  return attempts.filter((a) => a.outcome === "correct").map((a) => Date.parse(a.attemptedAt)).filter(Number.isFinite).sort((a,b)=>a-b);
}

function hasDelayedSuccess(attempts: AttemptRecord[]): boolean {
  const times = successfulAttemptTimes(attempts);
  return times.some((t, i) => i > 0 && t - times[i-1] >= DELAYED_REVIEW_MS);
}

function deriveNextReviewAt(attempts: AttemptRecord[], delayedCheckPassed: boolean): string | undefined {
  if (delayedCheckPassed) return undefined;
  const times = successfulAttemptTimes(attempts);
  if (!times.length) return undefined;
  return new Date(times[0] + DELAYED_REVIEW_MS).toISOString();
}

export function isCategoryUnlocked(category: ExerciseCategory, state: LearnerState): boolean {
  const index = CATEGORY_ORDER.indexOf(category);
  if (index <= 0) return true;
  const previous = state.skills[CATEGORY_ORDER[index - 1]].level;
  return previous === "mastery" || previous === "excellence";
}
