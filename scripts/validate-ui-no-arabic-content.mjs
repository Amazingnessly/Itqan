import fs from "node:fs";

const targets = [
  "src/pages/Lesson/LessonPage.tsx",
  "src/pages/Path/PathPage.tsx",
  "src/app/App.tsx",
];

const forbidden = /[\u0600-\u06FF]/u;
let failures = 0;

for (const file of targets) {
  const text = fs.readFileSync(file, "utf8");

  // The lesson interface may not hard-code Arabic lesson material.
  // The single qaf in the loading seal is UI identity, not lesson content.
  const withoutBrandSeal = text.replace(/>ق</g, "><");

  if (forbidden.test(withoutBrandSeal)) {
    console.error(`FAIL ${file}: direct Arabic lesson content detected.`);
    failures += 1;
  }
}

if (failures) process.exit(1);
console.log("OK: lesson UI contains no hard-coded Arabic exercise content.");
