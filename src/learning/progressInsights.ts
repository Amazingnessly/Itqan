import type {
  AttemptRecord,
  ExerciseCategory,
  LearnerState,
  MasteryLevel,
} from "./types";

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  reading_units: "Unités de lecture",
  vowels_sukun: "Voyelles & Sukūn",
  shaddah: "Shaddah",
  article_al: "Article",
  linking: "Enchaînement",
  fluent_reading: "Lecture fluide",
};

export const LEVEL_LABELS: Record<MasteryLevel, string> = {
  discovery: "Découverte",
  progression: "Progression",
  consolidation: "Consolidation",
  mastery: "Maîtrise",
  excellence: "Excellence",
};

export const LEVEL_SYMBOLS: Record<MasteryLevel, string> = {
  discovery: "🌱",
  progression: "🌿",
  consolidation: "🌳",
  mastery: "⭐",
  excellence: "👑",
};

export function accuracyPercent(
  state: LearnerState,
  category: ExerciseCategory
): number {
  const skill = state.skills[category];
  if (!skill.totalAttempts) return 0;
  return Math.round((skill.correctAttempts / skill.totalAttempts) * 100);
}

export function recentErrors(
  state: LearnerState,
  category: ExerciseCategory,
  windowSize = 12
): number {
  return state.attempts
    .filter((attempt) => attempt.category === category)
    .slice(-windowSize)
    .filter((attempt) => attempt.outcome === "incorrect").length;
}

export function totalReadingSeconds(state: LearnerState): number {
  return Math.round(
    state.attempts.reduce(
      (total, attempt) => total + (attempt.timing?.readingMs ?? 0),
      0
    ) / 1000
  );
}

export function completedCorrectAttempts(state: LearnerState): number {
  return state.attempts.filter((attempt) => attempt.outcome === "correct").length;
}

export function computeStreakDays(
  attempts: AttemptRecord[],
  now = new Date()
): number {
  const days = new Set(
    attempts
      .map((attempt) => new Date(attempt.attemptedAt))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => localDayKey(date))
  );

  if (!days.size) return 0;

  let cursor = startOfLocalDay(now);

  // A learner who has not practised yet today can keep yesterday's streak.
  if (!days.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (days.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function startOfLocalDay(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    0,
    0,
    0
  );
}

function localDayKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
