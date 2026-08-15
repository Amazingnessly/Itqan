import fs from "node:fs";

const required = [
  "src/learning/progressInsights.ts",
  "src/learning/reviewPlan.ts",
  "src/pages/Review/ReviewPage.tsx",
  "src/pages/Profile/ProfilePage.tsx",
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL missing ${file}`);
    process.exit(1);
  }
}

const review = fs.readFileSync("src/pages/Review/ReviewPage.tsx", "utf8");
if (!review.includes("buildReviewPlan")) {
  console.error("FAIL ReviewPage is not connected to adaptive review planning.");
  process.exit(1);
}

const profile = fs.readFileSync("src/pages/Profile/ProfilePage.tsx", "utf8");
if (!profile.includes("loadLearnerState")) {
  console.error("FAIL ProfilePage is not connected to learner state.");
  process.exit(1);
}

const path = fs.readFileSync("src/pages/Path/PathPage.tsx", "utf8");
if (!path.includes("LEVEL_LABELS")) {
  console.error("FAIL PathPage does not expose mastery state.");
  process.exit(1);
}

console.log("OK: Review, Profile and Path are connected to learner mastery data.");
