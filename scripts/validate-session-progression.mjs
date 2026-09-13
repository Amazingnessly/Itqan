import fs from "node:fs";

const lesson = fs.readFileSync("src/pages/Lesson/LessonPage.tsx", "utf8");
const catalog = fs.readFileSync("src/learning/sessionCatalog.ts", "utf8");
const progress = fs.readFileSync("src/learning/sessionProgress.ts", "utf8");
const registryGenerator = fs.readFileSync("scripts/generate-attempt-registry.mjs", "utf8");
const recordAttemptStart = lesson.indexOf("function recordAttempt");
const retryStart = lesson.indexOf("function retry", recordAttemptStart);
const recordAttemptBlock = recordAttemptStart >= 0 && retryStart > recordAttemptStart
  ? lesson.slice(recordAttemptStart, retryStart)
  : "";

const checks = [
  ["dynamic session selection", lesson.includes("nextSessionId")],
  ["session selection uses learner attempts", lesson.includes("nextSessionId(blueprint, learner.attempts)")],
  ["targeted sessions preserve canonical resume", lesson.includes("const resumeIndex = loadSessionResumeIndex(category, selectedId)") && !lesson.includes("preferredSessionId ? 0")],
  ["resumed completion summary includes prior exact positions", lesson.includes("setSessionCorrect(resumeIndex >= session.length ? 0 : resumeIndex)")],
  ["recording failures fail closed", recordAttemptBlock.includes("try {") && recordAttemptBlock.includes("engineRef.current.record") && recordAttemptBlock.includes("catch") && recordAttemptBlock.includes("setError(")],
  ["recording failure copy does not expose engine details", !recordAttemptBlock.includes("reason instanceof Error") && !recordAttemptBlock.includes("error.message")],
  ["completion API remains wired", lesson.includes("markSessionCompleted")],
  ["controlled Arabic resolution", lesson.includes("current.arabicExact")],
  ["no fixed pilot session", !lesson.includes("const SESSION_ID =")],
  ["catalog selector is cycle-aware", catalog.includes("sessionCompletionCountFromAuthorizedAttempts") && catalog.includes("attempts: AttemptRecord[]")],
  ["completion derives from learner attempts", progress.includes("completedSessionIdsFromAuthorizedAttempts")],
  ["legacy completion storage removed", !progress.includes("COMPLETED_SESSIONS_KEY")],
  ["registry preserves session interaction evidence", registryGenerator.includes("sessions[session.id] = itemIds")],
  ["registry supports cycle-aware resume", registryGenerator.includes("sessionCompletionCountFromAuthorizedAttempts") && registryGenerator.includes("completedCycles")],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`Session progression invariant failed: ${label}`);
}

console.log("OK: controlled multi-session progression contract passed.");
