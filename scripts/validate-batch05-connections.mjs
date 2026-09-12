import fs from "node:fs";

const required = [
  "src/learning/progressInsights.ts",
  "src/learning/reviewPlan.ts",
  "src/pages/Review/ReviewPage.tsx",
  "src/pages/Profile/ProfilePage.tsx",
  "src/pages/Lesson/LessonPage.tsx",
  "src/pages/Path/PathPage.tsx",
  "src/components/path/PathNode.tsx",
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
if (!path.includes("pathMastered") || !path.includes('pathMastered ? "Parcours maîtrisé"') || !path.includes('pathMastered || index < currentIndex ? "done"')) {
  console.error("FAIL PathPage does not represent final-path mastery as completed.");
  process.exit(1);
}

const pathNode = fs.readFileSync("src/components/path/PathNode.tsx", "utf8");
if (!pathNode.includes('state === "done" ? "Maîtrisé"')) {
  console.error("FAIL completed path stages are not labeled as mastered.");
  process.exit(1);
}

const lesson = fs.readFileSync("src/pages/Lesson/LessonPage.tsx", "utf8");
if (!lesson.includes("isCategoryAvailableForActiveLesson") || !lesson.includes("nextAvailable")) {
  console.error("FAIL LessonPage completion can confuse pedagogical unlock with runnable controlled content.");
  process.exit(1);
}
if (!lesson.includes("finalMasteryConfirmed") || !lesson.includes("Parcours maîtrisé.") || !lesson.includes("Retour au parcours")) {
  console.error("FAIL LessonPage does not handle final-category mastery explicitly.");
  process.exit(1);
}

console.log("OK: Review, Profile, Path and lesson completion are connected to safe learner/content availability data.");
