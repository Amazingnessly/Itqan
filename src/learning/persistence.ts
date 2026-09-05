import type { AttemptRecord, ExerciseCategory, LearnerState, TimingSample } from "./types";
import { createInitialLearnerState, deriveSkillState } from "./mastery";
import { isCanonicalAttemptTimestamp, MAX_FUTURE_CLOCK_SKEW_MS } from "./attemptTimestamp";

const LEARNER_KEY = "itqan:learner:v1";
const CATEGORIES: ExerciseCategory[] = ["reading_units", "vowels_sukun", "shaddah", "article_al", "linking", "fluent_reading"];
const OUTCOMES = new Set<AttemptRecord["outcome"]>(["correct", "incorrect", "skipped"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isOptionalNonNegativeFiniteNumber(value: unknown): boolean {
  return value === undefined || isNonNegativeFiniteNumber(value);
}

function isTimingSample(value: unknown): value is TimingSample {
  if (!isRecord(value)) return false;
  return isNonNegativeFiniteNumber(value.preparationMs)
    && isNonNegativeFiniteNumber(value.readingMs)
    && isNonNegativeFiniteNumber(value.totalMs)
    && isOptionalNonNegativeFiniteNumber(value.pauseCount)
    && isOptionalNonNegativeFiniteNumber(value.retryCount);
}

function isVoiceRecord(value: unknown): boolean {
  if (!isRecord(value) || typeof value.attempted !== "boolean") return false;
  if (!isOptionalNonNegativeFiniteNumber(value.providerScore)) return false;
  if (!isOptionalNonNegativeFiniteNumber(value.providerConfidence)) return false;
  return value.requiresHumanReview === undefined || typeof value.requiresHumanReview === "boolean";
}

function isAttemptRecord(value: unknown, latestAllowedMs: number): value is AttemptRecord {
  if (!isRecord(value)) return false;
  if (typeof value.itemId !== "string" || value.itemId.length === 0) return false;
  if (!CATEGORIES.includes(value.category as ExerciseCategory)) return false;
  if (typeof value.sessionId !== "string" || value.sessionId.length === 0) return false;
  if (!isCanonicalAttemptTimestamp(value.attemptedAt, latestAllowedMs)) return false;
  if (!OUTCOMES.has(value.outcome as AttemptRecord["outcome"])) return false;
  if (value.timing !== undefined && !isTimingSample(value.timing)) return false;
  if (value.voice !== undefined && !isVoiceRecord(value.voice)) return false;
  return true;
}

export function sanitizeLearnerState(value: unknown, now = new Date()): LearnerState | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (!isNonNegativeInteger(value.xp) || !isNonNegativeInteger(value.streakDays)) return null;
  const latestAllowedMs = now.getTime() + MAX_FUTURE_CLOCK_SKEW_MS;
  if (!Number.isFinite(latestAllowedMs)) return null;
  if (!Array.isArray(value.attempts) || !value.attempts.every((attempt) => isAttemptRecord(attempt, latestAllowedMs))) return null;

  const attempts = value.attempts;
  const skills = Object.fromEntries(CATEGORIES.map((category) => [category, deriveSkillState(category, attempts)])) as LearnerState["skills"];
  return { version: 1, xp: value.xp, streakDays: value.streakDays, attempts, skills };
}

export function loadLearnerState(): LearnerState {
  try {
    const raw = localStorage.getItem(LEARNER_KEY);
    if (!raw) return createInitialLearnerState();

    return sanitizeLearnerState(JSON.parse(raw)) ?? createInitialLearnerState();
  } catch {
    return createInitialLearnerState();
  }
}

export function saveLearnerState(state: LearnerState): void {
  try {
    localStorage.setItem(LEARNER_KEY, JSON.stringify(state));
  } catch {
    // Storage availability must never block the active lesson.
  }
}

export function loadSessionCursor(sessionId: string): number {
  try {
    const value = Number(localStorage.getItem(`itqan:session:${sessionId}`));
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveSessionCursor(sessionId: string, index: number): void {
  try {
    localStorage.setItem(`itqan:session:${sessionId}`, String(index));
  } catch {
    // Cursor persistence is best effort; the current lesson may continue.
  }
}

export function clearSessionCursor(sessionId: string): void {
  try {
    localStorage.removeItem(`itqan:session:${sessionId}`);
  } catch {
    // A storage failure must not block session completion.
  }
}
