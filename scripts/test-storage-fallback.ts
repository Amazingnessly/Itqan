import assert from "node:assert/strict";
import { createInitialLearnerState } from "../src/learning/mastery";
import { loadLearnerState, sanitizeLearnerState, saveLearnerState } from "../src/learning/persistence";

const practiced = sanitizeLearnerState({
  version: 1,
  attempts: [{
    itemId: "S110-P003-001",
    category: "reading_units",
    sessionId: "UNITS-B01-S01",
    attemptedAt: "2026-08-24T08:00:00.000Z",
    outcome: "correct",
  }],
}, new Date("2026-08-24T12:00:00.000Z"));
assert.ok(practiced);

const unavailableStorage = {
  getItem: () => { throw new Error("storage unavailable"); },
  setItem: () => { throw new Error("storage unavailable"); },
  removeItem: () => { throw new Error("storage unavailable"); },
  clear: () => undefined,
  key: () => null,
  length: 0,
} satisfies Storage;
Object.defineProperty(globalThis, "localStorage", { value: unavailableStorage, configurable: true });

assert.doesNotThrow(() => saveLearnerState(practiced));
const recovered = loadLearnerState();
assert.equal(recovered.attempts.length, 1);
assert.equal(recovered.attempts[0]?.itemId, "S110-P003-001");
assert.equal(recovered.skills.reading_units.totalAttempts, 1);

const values = new Map<string, string>();
const workingStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
  clear: () => values.clear(),
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size; },
} satisfies Storage;
Object.defineProperty(globalThis, "localStorage", { value: workingStorage, configurable: true });

const initial = createInitialLearnerState();
saveLearnerState(initial);
assert.equal(loadLearnerState().attempts.length, 0);

console.log("In-memory learner storage fallback tests passed.");
