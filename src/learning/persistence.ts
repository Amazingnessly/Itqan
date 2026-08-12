import type { LearnerState } from "./types";
import { createInitialLearnerState } from "./mastery";

const LEARNER_KEY = "itqan:learner:v1";

export function loadLearnerState(): LearnerState {
  try {
    const raw = localStorage.getItem(LEARNER_KEY);
    if (!raw) return createInitialLearnerState();

    const parsed = JSON.parse(raw) as LearnerState;
    if (parsed.version !== 1) return createInitialLearnerState();
    return parsed;
  } catch {
    return createInitialLearnerState();
  }
}

export function saveLearnerState(state: LearnerState): void {
  localStorage.setItem(LEARNER_KEY, JSON.stringify(state));
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
  localStorage.setItem(`itqan:session:${sessionId}`, String(index));
}

export function clearSessionCursor(sessionId: string): void {
  localStorage.removeItem(`itqan:session:${sessionId}`);
}
