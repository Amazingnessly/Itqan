import fs from "node:fs";

const path = "scripts/test-learning-policy.ts";
let text = fs.readFileSync(path, "utf8");

const availabilityBefore = 'await run("active lesson availability requires both unlock and controlled content", () => { const state = createInitialLearnerState(); assert.equal(isCategoryAvailableForActiveLesson("reading_units", state), true); state.skills.reading_units = { ...state.skills.reading_units, level: "mastery" }; assert.equal(isCategoryUnlocked("vowels_sukun", state), true); assert.equal(isCategoryAvailableForActiveLesson("vowels_sukun", state), true); state.skills.vowels_sukun = { ...state.skills.vowels_sukun, level: "mastery" }; assert.equal(isCategoryUnlocked("shaddah", state), true); assert.equal(isCategoryAvailableForActiveLesson("shaddah", state), false); });';
const availabilityAfter = 'await run("active lesson availability requires both unlock and controlled content", () => { const state = createInitialLearnerState(); assert.equal(isCategoryAvailableForActiveLesson("reading_units", state), true); state.skills.reading_units = { ...state.skills.reading_units, level: "mastery" }; assert.equal(isCategoryUnlocked("vowels_sukun", state), true); assert.equal(isCategoryAvailableForActiveLesson("vowels_sukun", state), true); state.skills.vowels_sukun = { ...state.skills.vowels_sukun, level: "mastery" }; assert.equal(isCategoryUnlocked("shaddah", state), true); assert.equal(isCategoryAvailableForActiveLesson("shaddah", state), true); state.skills.shaddah = { ...state.skills.shaddah, level: "mastery" }; assert.equal(isCategoryUnlocked("article_al", state), true); assert.equal(isCategoryAvailableForActiveLesson("article_al", state), false); });';

const skipBefore = 'await run("review planning skips an unlocked category with no active session", () => { const state = createInitialLearnerState(); state.skills.reading_units = { ...state.skills.reading_units, level: "mastery", stableAcrossContexts: true, delayedCheckPassed: true }; state.skills.vowels_sukun = { ...state.skills.vowels_sukun, level: "mastery", stableAcrossContexts: true, delayedCheckPassed: true }; state.skills.shaddah = { ...state.skills.shaddah, level: "progression", stableAcrossContexts: true, nextReviewAt: "2026-08-24T08:00:00.000Z" }; state.attempts = [attempt("shaddah", "SHADDAH-B02-S01", "2026-08-23T20:00:00.000Z", "correct")]; const plan = buildReviewPlan(state, new Date("2026-08-24T20:00:00.000Z")); assert.notEqual(plan.category, "shaddah"); });';
const skipAfter = 'await run("review planning skips an unlocked category with no active session", () => { const state = createInitialLearnerState(); state.skills.reading_units = { ...state.skills.reading_units, level: "mastery", stableAcrossContexts: true, delayedCheckPassed: true }; state.skills.vowels_sukun = { ...state.skills.vowels_sukun, level: "mastery", stableAcrossContexts: true, delayedCheckPassed: true }; state.skills.shaddah = { ...state.skills.shaddah, level: "mastery", stableAcrossContexts: true, delayedCheckPassed: true }; state.skills.article_al = { ...state.skills.article_al, level: "progression", stableAcrossContexts: true, nextReviewAt: "2026-08-24T08:00:00.000Z" }; state.attempts = [attempt("article_al", "ARTICLE_AL-B02-S01", "2026-08-23T20:00:00.000Z", "correct")]; const plan = buildReviewPlan(state, new Date("2026-08-24T20:00:00.000Z")); assert.notEqual(plan.category, "article_al"); });';

const vowelsReview = 'await run("review planning can target an active vowels-sukun session after reading mastery", () => { const state = createInitialLearnerState(); state.skills.reading_units = { ...state.skills.reading_units, level: "mastery", stableAcrossContexts: true, delayedCheckPassed: true }; state.attempts = [attempt("vowels_sukun", "VOWELS_SUKUN-B02-S01", "2026-08-24T08:00:00.000Z", "incorrect", 1), attempt("vowels_sukun", "VOWELS_SUKUN-B02-S01", "2026-08-24T09:00:00.000Z", "incorrect", 2)]; state.skills.vowels_sukun = deriveSkillState("vowels_sukun", state.attempts); const plan = buildReviewPlan(state, new Date("2026-08-24T20:00:00.000Z")); assert.equal(plan.category, "vowels_sukun"); assert.equal(plan.targetSessionId, "VOWELS_SUKUN-B02-S01"); });';
const shaddahReview = 'await run("review planning can target an active shaddah session after vowels-sukun mastery", () => { const state = createInitialLearnerState(); state.skills.reading_units = { ...state.skills.reading_units, level: "mastery", stableAcrossContexts: true, delayedCheckPassed: true }; state.skills.vowels_sukun = { ...state.skills.vowels_sukun, level: "mastery", stableAcrossContexts: true, delayedCheckPassed: true }; state.attempts = [attempt("shaddah", "SHADDAH-B02-S01", "2026-08-24T08:00:00.000Z", "incorrect", 1), attempt("shaddah", "SHADDAH-B02-S01", "2026-08-24T09:00:00.000Z", "incorrect", 2)]; state.skills.shaddah = deriveSkillState("shaddah", state.attempts); const plan = buildReviewPlan(state, new Date("2026-08-24T20:00:00.000Z")); assert.equal(plan.category, "shaddah"); assert.equal(plan.targetSessionId, "SHADDAH-B02-S01"); });';

if (text.includes(availabilityAfter) && text.includes(skipAfter) && text.includes(shaddahReview)) {
  console.log("OK: shaddah test fixtures already updated.");
  process.exit(0);
}
for (const [before, after, label] of [
  [availabilityBefore, availabilityAfter, "availability"],
  [skipBefore, skipAfter, "inactive-category review"],
]) {
  if (!text.includes(before)) throw new Error(`Learning-policy ${label} fixture changed.`);
  text = text.replace(before, after);
}
if (!text.includes(vowelsReview)) throw new Error("Vowels review fixture changed.");
text = text.replace(vowelsReview, `${vowelsReview}\n${shaddahReview}`);
fs.writeFileSync(path, text, "utf8");
console.log("OK: shaddah learning-policy fixtures updated.");
