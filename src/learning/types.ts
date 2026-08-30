export type ExerciseCategory =
  | "reading_units"
  | "vowels_sukun"
  | "shaddah"
  | "article_al"
  | "linking"
  | "fluent_reading";

export type MasteryLevel =
  | "discovery"
  | "progression"
  | "consolidation"
  | "mastery"
  | "excellence";

export type AttemptOutcome = "correct" | "incorrect" | "skipped";

export type TimingSample = {
  preparationMs: number;
  readingMs: number;
  totalMs: number;
  pauseCount?: number;
  retryCount?: number;
};

export type AttemptRecord = {
  itemId: string;
  category: ExerciseCategory;
  sessionId: string;
  attemptedAt: string;
  outcome: AttemptOutcome;
  timing?: TimingSample;
  voice?: {
    attempted: boolean;
    providerScore?: number;
    providerConfidence?: number;
    requiresHumanReview?: boolean;
  };
};

export type SkillState = {
  category: ExerciseCategory;
  level: MasteryLevel;
  totalAttempts: number;
  correctAttempts: number;
  recentAccuracy: number;
  delayedCheckPassed: boolean;
  stableAcrossContexts: boolean;
  lastPracticedAt?: string;
  nextReviewAt?: string;
};

export type LearnerState = {
  version: 1;
  xp: number;
  streakDays: number;
  attempts: AttemptRecord[];
  skills: Record<ExerciseCategory, SkillState>;
};

export type BlueprintInteraction = {
  order: number;
  mode: string;
  itemId: string;
  visibleArabicComesFromManifestOnly?: true;
  precisionRequired: true;
  timing: "off" | "hidden";
  voice: "off" | "optional";
};

export type BlueprintSession = {
  id: string;
  interactionCount: number;
  interactions: BlueprintInteraction[];
};

export type ExerciseBlueprint = {
  id: string;
  category: ExerciseCategory;
  status: string;
  itemPoolSize?: number;
  sessions: BlueprintSession[];
  unlockPolicy: {
    singleSessionCompletionIsMastery: false;
    requiresMultipleContexts: true;
    requiresDelayedCheck: true;
    speedCanNeverCompensateForErrors: true;
    timingOnlyAfterPrecisionStability?: boolean;
  };
};

export type ControlledContentItem = {
  id: string;
  arabicExact: string;
  allowedExerciseTypes: ExerciseCategory[];
  eligibleForActiveLesson: boolean;
  active: boolean;
  verification: {
    visualPass1: true;
    visualPass2: true;
    ambiguous: false;
  };
};

export type ControlledBatch = {
  batchId: string;
  /** Informational manifest metadata. Runtime activation is intentionally item-scoped. */
  status?: string;
  items: ControlledContentItem[];
};
