import fs from "node:fs";

const required = [
  "src/app/App.tsx",
  "src/learning/progressInsights.ts",
  "src/learning/reviewPlan.ts",
  "src/pages/Home/HomePage.tsx",
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

const insights = fs.readFileSync("src/learning/progressInsights.ts", "utf8");
if (!insights.includes("recentAccuracyPercent") || !insights.includes("skill.recentAccuracy * 100")) {
  console.error("FAIL recent precision percentage is not derived from the canonical recent accuracy state.");
  process.exit(1);
}

const reviewPlan = fs.readFileSync("src/learning/reviewPlan.ts", "utf8");
if (!reviewPlan.includes('priorityKind: RevisionPriority["reason"]') || !reviewPlan.includes("priorityKind: selected.reason")) {
  console.error("FAIL ReviewPlan does not expose the canonical revision-engine priority kind.");
  process.exit(1);
}
if (
  !reviewPlan.includes("buildReviewLaunchTarget")
  || !reviewPlan.includes("mostRecentIncompleteLessonTarget")
  || !reviewPlan.includes('plan.priorityKind === "recent_errors"')
  || !reviewPlan.includes('plan.priorityKind === "review_due"')
  || !reviewPlan.includes('kind: "urgent_review"')
  || !reviewPlan.includes('kind: "incomplete_session"')
) {
  console.error("FAIL ReviewPlan does not keep urgent review ahead of canonical incomplete-session resume.");
  process.exit(1);
}

const home = fs.readFileSync("src/pages/Home/HomePage.tsx", "utf8");
if (
  !home.includes("buildReviewLaunchTarget")
  || !home.includes('launchTarget.kind === "urgent_review"')
  || !home.includes('launchTarget.kind === "incomplete_session"')
  || !home.includes("launchTarget.targetSessionId")
  || home.includes("mostRecentIncompleteLessonTarget")
) {
  console.error("FAIL HomePage bypasses the canonical urgent/incomplete-session launch priority.");
  process.exit(1);
}

const app = fs.readFileSync("src/app/App.tsx", "utf8");
if (
  !app.includes('startLesson("home", category, targetSessionId, targetStageId)')
  || !app.includes("preferredStageId")
  || !app.includes("isLearningStageAvailableForActiveLesson")
) {
  console.error("FAIL App does not preserve HomePage targeted-review/stage session routing.");
  process.exit(1);
}

const review = fs.readFileSync("src/pages/Review/ReviewPage.tsx", "utf8");
if (!review.includes("buildReviewPlan") || !review.includes("buildReviewLaunchTarget")) {
  console.error("FAIL ReviewPage is not connected to adaptive review planning and canonical launch priority.");
  process.exit(1);
}
if (!review.includes("hasPrecisionStability") || !review.includes("needsPrecisionStability") || !review.includes("Stabiliser la précision")) {
  console.error("FAIL ReviewPage does not use canonical precision stability for non-urgent guidance.");
  process.exit(1);
}
if (!review.includes("recentAccuracyPercent") || !review.includes("Précision récente")) {
  console.error("FAIL ReviewPage can explain current learner state with cumulative rather than recent precision.");
  process.exit(1);
}
if (
  !review.includes('launchTarget.kind === "urgent_review"')
  || !review.includes('launchTarget.kind === "incomplete_session"')
  || !review.includes("onStart(category, launchTarget.targetSessionId)")
) {
  console.error("FAIL ReviewPage can bypass canonical urgent/incomplete-session launch priority.");
  process.exit(1);
}

const profile = fs.readFileSync("src/pages/Profile/ProfilePage.tsx", "utf8");
if (!profile.includes("loadLearnerState")) {
  console.error("FAIL ProfilePage is not connected to learner state.");
  process.exit(1);
}
if (!profile.includes("hasPrecisionStability") || !profile.includes("precisionStable")) {
  console.error("FAIL ProfilePage can claim stable precision from context evidence alone.");
  process.exit(1);
}
if (!profile.includes("recentAccuracyPercent") || !profile.includes("% récent")) {
  console.error("FAIL ProfilePage skill metrics do not identify recent precision explicitly.");
  process.exit(1);
}

const path = fs.readFileSync("src/pages/Path/PathPage.tsx", "utf8");
if (!path.includes("LEVEL_LABELS") || !path.includes("learningStageSkill")) {
  console.error("FAIL PathPage does not expose stage-scoped mastery state.");
  process.exit(1);
}
if (!path.includes("currentSkill.recentAccuracy") || !path.includes("Précision récente")) {
  console.error("FAIL PathPage can present cumulative precision instead of stage-scoped recent precision.");
  process.exit(1);
}
if (
  !path.includes("LEARNING_STAGES")
  || !path.includes("isLearningStageMastered")
  || !path.includes("isLearningStageAvailableForActiveLesson")
  || !path.includes("pathMastered")
  || !path.includes('pathMastered ? "Parcours maîtrisé"')
  || !path.includes('mastered ? "done"')
) {
  console.error("FAIL PathPage does not represent the seven-stage path and completed-stage mastery.");
  process.exit(1);
}

const pathNode = fs.readFileSync("src/components/path/PathNode.tsx", "utf8");
if (!pathNode.includes('state === "done" ? "Maîtrisé"')) {
  console.error("FAIL completed path stages are not labeled as mastered.");
  process.exit(1);
}

const lesson = fs.readFileSync("src/pages/Lesson/LessonPage.tsx", "utf8");
if (
  !lesson.includes("isCategoryAvailableForActiveLesson")
  || !lesson.includes("isLearningStageAvailableForActiveLesson")
  || !lesson.includes("learningStageSkill")
  || !lesson.includes("nextLearningStage")
  || !lesson.includes("nextAvailable")
) {
  console.error("FAIL LessonPage completion can confuse stage unlock with runnable controlled content.");
  process.exit(1);
}
if (!lesson.includes("finalMasteryConfirmed") || !lesson.includes("Parcours maîtrisé.") || !lesson.includes("Retour au parcours")) {
  console.error("FAIL LessonPage does not handle final-category mastery explicitly.");
  process.exit(1);
}

console.log("OK: Home, Review, Profile, Path and lesson completion are connected to safe learner/content availability data.");
