import fs from "node:fs";

const css = fs.readFileSync("src/styles/global.css", "utf8");
const lesson = fs.readFileSync("src/pages/Lesson/LessonPage.tsx", "utf8");
const home = fs.readFileSync("src/pages/Home/HomePage.tsx", "utf8");

const checks = [
  ["safe-area support", css.includes("safe-area-inset-bottom")],
  ["reduced motion support", css.includes("prefers-reduced-motion")],
  ["four-step method strip", lesson.includes("METHOD_STEPS")],
  ["controlled Arabic resolution", lesson.includes("current.arabicExact")],
  ["hidden timing copy", lesson.includes("chronomètre reste invisible")],
  ["home path access", home.includes("onOpenPath")],
];

let failures = 0;
for (const [label, ok] of checks) {
  if (!ok) {
    failures += 1;
    console.error(`FAIL visual contract: ${label}`);
  }
}

if (failures) process.exit(1);
console.log("OK: Batch 06 mobile/lesson visual contract passed.");
