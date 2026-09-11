import fs from "node:fs";

const files = {
  mastery: fs.readFileSync("src/learning/mastery.ts", "utf8"),
  timingPolicy: fs.readFileSync("src/learning/timingPolicy.ts", "utf8"),
  sessionEngine: fs.readFileSync("src/learning/sessionEngine.ts", "utf8"),
  persistence: fs.readFileSync("src/learning/persistence.ts", "utf8"),
  lesson: fs.readFileSync("src/pages/Lesson/LessonPage.tsx", "utf8"),
  generator: fs.readFileSync("scripts/generate-attempt-registry.mjs", "utf8"),
};

const required = [
  [files.mastery, "hasPrecisionStability", "mastery precision-stability predicate"],
  [files.timingPolicy, 'interaction.timing === "hidden"', "hidden timing gate"],
  [files.timingPolicy, "hasPrecisionStability(skill)", "precision evidence gate"],
  [files.sessionEngine, "mayObserveTiming(interaction, skill)", "session-engine timing enforcement"],
  [files.persistence, "controlledObservationPolicyForAttempt", "persisted interaction policy reconciliation"],
  [files.persistence, "hasPrecisionStability(priorSkill)", "persisted precision-before-timing reconciliation"],
  [files.lesson, "mayObserveTiming(current.interaction, skill)", "LessonPage timing enforcement"],
  [files.lesson, "const timer = timingAllowed ? new ReadingTimer() : null;", "LessonPage gated timer creation"],
  [files.generator, "INTERACTION_POLICIES", "generated interaction observation policies"],
];

for (const [source, needle, label] of required) {
  if (!source.includes(needle)) {
    console.error(`FAIL missing ${label}.`);
    process.exit(1);
  }
}

if (files.lesson.includes('const timer = current.interaction.timing === "hidden" ? new ReadingTimer() : null;')) {
  console.error("FAIL LessonPage can start hidden timing without precision stability.");
  process.exit(1);
}
if (files.sessionEngine.includes('const timing = interaction.timing === "hidden" ? input.timing : undefined;')) {
  console.error("FAIL session engine can retain hidden timing without precision stability.");
  process.exit(1);
}

console.log("OK: hidden timing is wired through precision stability in UI, runtime and persisted-state reconciliation.");
