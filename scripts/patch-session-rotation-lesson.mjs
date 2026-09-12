import fs from "node:fs";

const path = "src/pages/Lesson/LessonPage.tsx";
let text = fs.readFileSync(path, "utf8");

const importBefore = "  loadCompletedSessionIds,\n  loadLearnerState,";
const importAfter = "  loadLearnerState,";
const selectionBefore = "          const selectedId = preferredSessionId ?? nextSessionId(blueprint, loadCompletedSessionIds());";
const selectionAfter = "          const selectedId = preferredSessionId ?? nextSessionId(blueprint, learner.attempts);";

if (text.includes(importAfter) && !text.includes(importBefore) && text.includes(selectionAfter)) {
  console.log("OK: LessonPage already selects sessions from authorized attempt cycles.");
  process.exit(0);
}
if (!text.includes(importBefore)) throw new Error("LessonPage completed-session import contract changed.");
if (!text.includes(selectionBefore)) throw new Error("LessonPage session selection contract changed.");
text = text.replace(importBefore, importAfter).replace(selectionBefore, selectionAfter);
fs.writeFileSync(path, text, "utf8");
console.log("OK: LessonPage now rotates controlled sessions from authorized attempt cycles.");
