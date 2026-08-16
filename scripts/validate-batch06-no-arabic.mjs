import fs from "node:fs";

const targets = [
  "src/app/App.tsx",
  "src/pages/Home/HomePage.tsx",
  "src/pages/Lesson/LessonPage.tsx",
];

const arabic = /[\u0600-\u06FF]/u;
let failures = 0;

for (const file of targets) {
  let text = fs.readFileSync(file, "utf8");

  // Brand seal only; lesson content itself must always come from controlled manifests.
  text = text.replace(/>ق</g, "><");

  if (arabic.test(text)) {
    failures += 1;
    console.error(`FAIL ${file}: direct Arabic exercise content detected.`);
  }
}

if (failures) process.exit(1);
console.log("OK: Batch 06 introduces no hard-coded Arabic exercise strings.");
