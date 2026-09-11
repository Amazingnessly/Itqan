import fs from "node:fs";

const path = "src/pages/Lesson/LessonPage.tsx";
let text = fs.readFileSync(path, "utf8");

const importNeedle = "  nextSessionId,\n  isCategoryAvailableForActiveLesson,\n  saveLearnerState,";
const importReplacement = "  nextSessionId,\n  isCategoryAvailableForActiveLesson,\n  mayObserveTiming,\n  saveLearnerState,";
const stateNeedle = '  const skill = learner.skills[category];\n  const timingNotice = current?.interaction.timing === "hidden" ? "Le chronomètre reste invisible." : "Cette lecture n’est pas chronométrée.";';
const stateReplacement = '  const skill = learner.skills[category];\n  const timingAllowed = current ? mayObserveTiming(current.interaction, skill) : false;\n  const timingNotice = current?.interaction.timing === "hidden"\n    ? timingAllowed\n      ? "Le chronomètre reste invisible."\n      : "Le chronométrage reste désactivé tant que la précision n’est pas stable."\n    : "Cette lecture n’est pas chronométrée.";';
const timerNeedle = '    const timer = current.interaction.timing === "hidden" ? new ReadingTimer() : null;';
const timerReplacement = '    const timer = timingAllowed ? new ReadingTimer() : null;';

if (text.includes(importReplacement) && text.includes(stateReplacement) && text.includes(timerReplacement)) {
  console.log("OK: LessonPage precision-before-timing gate already applied.");
  process.exit(0);
}
if (!text.includes(importNeedle)) throw new Error("LessonPage learning import contract changed.");
text = text.replace(importNeedle, importReplacement);
if (!text.includes(stateNeedle)) throw new Error("LessonPage timing notice contract changed.");
text = text.replace(stateNeedle, stateReplacement);
if (!text.includes(timerNeedle)) throw new Error("LessonPage timer creation contract changed.");
text = text.replace(timerNeedle, timerReplacement);
fs.writeFileSync(path, text, "utf8");
console.log("OK: LessonPage now starts hidden timing only after precision stability.");
