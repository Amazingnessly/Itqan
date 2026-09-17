import {
  CATEGORY_ORDER,
  LEARNING_STAGES,
  learningStage,
  type LearningStageId,
} from "./categoryCatalog";
import { chronologicalAttempts } from "./attemptOrder";
import type { AttemptRecord, ExerciseCategory, LearnerState, MasteryLevel, SkillState } from "./types";

const DELAYED_REVIEW_MS = 12 * 60 * 60 * 1000;

export const DEFAULT_MASTERY_POLICY = {
  recentWindow: 20,
  contextWindow: 30,
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
  const attempts = chronologicalAttempts([...state.attempts, attempt]);
  return { ...state, attempts, xp: deriveXp(attempts), skills: { ...state.skills, [attempt.category]: deriveSkillState(attempt.category, attempts) } };
}

export function deriveSkillState(category: ExerciseCategory, attempts: AttemptRecord[]): SkillState {
  const relevant = chronologicalAttempts(attempts.filter((a) => a.category === category));
  const scored = relevant.filter((a) => a.outcome !== "skipped");
  const correct = scored.filter((a) => a.outcome === "correct");
  const recent = scored.slice(-DEFAULT_MASTERY_POLICY.recentWindow);
  const recentAccuracy = recent.length ? recent.filter((a) => a.outcome === "correct").length / recent.length : 0;
  const recentContextEvidence = scored.slice(-DEFAULT_MASTERY_POLICY.contextWindow);
  const stableAcrossContexts = recentContextEvidence.length >= 12
    && new Set(recentContextEvidence.filter((a) => a.outcome === "correct").map((a) => a.sessionId)).size >= 3;
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

export function attemptsForLearningStage(
  stageId: LearningStageId,
  attempts: AttemptRecord[],
): AttemptRecord[] {
  const stage = learningStage(stageId);
  const sessionSet = stage.sessionIds ? new Set<string>(stage.sessionIds) : null;
  return attempts.filter((attempt) =>
    attempt.category === stage.category
    && (!sessionSet || sessionSet.has(attempt.sessionId))
  );
}

export function deriveLearningStageSkill(
  stageId: LearningStageId,
  attempts: AttemptRecord[],
): SkillState {
  const stage = learningStage(stageId);
  return deriveSkillState(stage.category, attemptsForLearningStage(stageId, attempts));
}

export function learningStageSkill(
  state: LearnerState,
  stageId: LearningStageId,
): SkillState {
  const stage = learningStage(stageId);
  return stage.sessionIds
    ? deriveLearningStageSkill(stageId, state.attempts)
    : state.skills[stage.category];
}

export function hasPrecisionStability(skill: SkillState): boolean {
  return skill.stableAcrossContexts
    && skill.recentAccuracy >= DEFAULT_MASTERY_POLICY.consolidationAccuracy;
}

function chooseLevel(total: number, accuracy: number, stable: boolean, delayed: boolean): MasteryLevel {
  const p = DEFAULT_MASTERY_POLICY;
  if (total >= p.minimumAttemptsForExcellence && accuracy >= p.excellenceAccuracy && stable && delayed) return "excellence";
  if (total >= p.minimumAttemptsForMastery && accuracy >= p.masteryAccuracy && stable && delayed) return "mastery";
  if (total >= p.minimumAttemptsForConsolidation && accuracy >= p.consolidationAccuracy && stable) return "consolidation";
  if (total >= p.minimumAttemptsForProgression && accuracy >= p.progressionAccuracy) return "progression";
  return "discovery";
}

function attemptsSinceLatestIncorrect(attempts: AttemptRecord[]): AttemptRecord[] {
  const ordered = chronologicalAttempts(attempts);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    if (ordered[index].outcome === "incorrect") return ordered.slice(index + 1);
  }
  return ordered;
}

function successfulAttemptTimes(attempts: AttemptRecord[]): number[] {
  return attemptsSinceLatestIncorrect(attempts)
    .filter((a) => a.outcome === "correct")
    .map((a) => Date.parse(a.attemptedAt))
    .filter(Number.isFinite)
    .sort((a,b)=>a-b);
}

function hasDelayedSuccess(attempts: AttemptRecord[]): boolean {
  const times = successfulAttemptTimes(attempts);
  return times.some((t, i) => i > 0 && t - times[i-1] >= DELAYED_REVIEW_MS);
}

function deriveNextReviewAt(attempts: AttemptRecord[], delayedCheckPassed: boolean): string | undefined {
  if (delayedCheckPassed) return undefined;
  const times = successfulAttemptTimes(attempts);
  if (!times.length) return undefined;
  return new Date(times.at(-1)! + DELAYED_REVIEW_MS).toISOString();
}

function levelUnlocksNextCategory(level: MasteryLevel): boolean {
  return level === "mastery" || level === "excellence";
}

export function isLearningStageMastered(
  stageId: LearningStageId,
  state: LearnerState,
): boolean {
  return levelUnlocksNextCategory(learningStageSkill(state, stageId).level);
}

export function isLearningStageMasteredFromAttempts(
  stageId: LearningStageId,
  attempts: AttemptRecord[],
): boolean {
  return levelUnlocksNextCategory(deriveLearningStageSkill(stageId, attempts).level);
}

export function isLearningStageUnlocked(
  stageId: LearningStageId,
  state: LearnerState,
): boolean {
  const index = LEARNING_STAGES.findIndex((stage) => stage.id === stageId);
  if (index <= 0) return index === 0;
  return LEARNING_STAGES.slice(0, index).every((stage) =>
    isLearningStageMastered(stage.id, state)
  );
}

export function isLearningStageUnlockedFromAttempts(
  stageId: LearningStageId,
  attempts: AttemptRecord[],
): boolean {
  const index = LEARNING_STAGES.findIndex((stage) => stage.id === stageId);
  if (index <= 0) return index === 0;
  return LEARNING_STAGES.slice(0, index).every((stage) =>
    isLearningStageMasteredFromAttempts(stage.id, attempts)
  );
}

export function currentLearningStage(state: LearnerState) {
  return LEARNING_STAGES.find((stage) =>
    isLearningStageUnlocked(stage.id, state)
    && !isLearningStageMastered(stage.id, state)
  ) ?? LEARNING_STAGES.at(-1)!;
}

export function nextLearningStage(stageId: LearningStageId) {
  const index = LEARNING_STAGES.findIndex((stage) => stage.id === stageId);
  return index >= 0 ? LEARNING_STAGES[index + 1] : undefined;
}

export function isCategoryUnlockedFromAttempts(
  category: ExerciseCategory,
  attempts: AttemptRecord[],
): boolean {
  return LEARNING_STAGES
    .filter((stage) => stage.category === category)
    .some((stage) => isLearningStageUnlockedFromAttempts(stage.id, attempts));
}

export function isCategoryUnlocked(category: ExerciseCategory, state: LearnerState): boolean {
  return LEARNING_STAGES
    .filter((stage) => stage.category === category)
    .some((stage) => isLearningStageUnlocked(stage.id, state));
}

export function isPathMastered(state: LearnerState): boolean {
  return LEARNING_STAGES.every((stage) => isLearningStageMastered(stage.id, state));
}
