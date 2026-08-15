import fs from "node:fs";

const targets = [
  "src/learning/progressInsights.ts",
  "src/learning/reviewPlan.ts",
  "src/pages/Home/HomePage.tsx",
  "src/pages/Path/PathPage.tsx",
  "src/pages/Review/ReviewPage.tsx",
  "src/pages/Profile/ProfilePage.tsx",
  "src/app/App.tsx",
];

const arabic = /[\u0600-\u06FF]/u;
let failures = 0;

for (const file of targets) {
  const text = fs.readFileSync(file, "utf8");
  if (arabic.test(text)) {
    failures += 1;
    console.error(`FAIL ${file}: Arabic literal found in Batch 05 application logic/UI.`);
  }
}

if (failures) process.exit(1);
console.log("OK: Batch 05 adds no hard-coded Arabic strings.");
