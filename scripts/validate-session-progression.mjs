import fs from "node:fs";

const lesson = fs.readFileSync("src/pages/Lesson/LessonPage.tsx", "utf8");
const catalog = fs.readFileSync("src/learning/sessionCatalog.ts", "utf8");
const progress = fs.readFileSync("src/learning/sessionProgress.ts", "utf8");

const checks = [
  ["dynamic session selection", lesson.includes("nextSessionId")],
  ["completed session persistence", lesson.includes("markSessionCompleted")],
  ["controlled Arabic resolution", lesson.includes("current.arabicExact")],
  ["no fixed pilot session", !lesson.includes("const SESSION_ID =")],
  ["catalog selector", catalog.includes("completedSessionIds")],
  ["completion storage", progress.includes("COMPLETED_SESSIONS_KEY")],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`Session progression invariant failed: ${label}`);
}

console.log("OK: controlled multi-session progression contract passed.");
