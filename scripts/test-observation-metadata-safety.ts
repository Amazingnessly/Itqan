import assert from "node:assert/strict";
import { sanitizeLearnerState } from "../src/learning/persistence";

const baseAttempt = {
  itemId: "S110-P003-001",
  category: "reading_units" as const,
  sessionId: "UNITS-B01-S01",
  attemptedAt: "2026-08-24T08:00:00.000Z",
  outcome: "correct" as const,
};
const now = new Date("2026-08-24T12:00:00.000Z");

assert.ok(sanitizeLearnerState({
  version: 1,
  attempts: [{
    ...baseAttempt,
    voice: { attempted: true, providerScore: 0, providerConfidence: 1 },
  }],
}, now));

assert.equal(sanitizeLearnerState({
  version: 1,
  attempts: [{
    ...baseAttempt,
    voice: { attempted: true, providerScore: 1.01, providerConfidence: 0.8 },
  }],
}, now), null);

assert.equal(sanitizeLearnerState({
  version: 1,
  attempts: [{
    ...baseAttempt,
    voice: { attempted: true, providerScore: 0.8, providerConfidence: 1.01 },
  }],
}, now), null);

console.log("Persisted observation metadata safety tests passed.");
