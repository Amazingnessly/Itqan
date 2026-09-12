import fs from "node:fs";

const lesson = fs.readFileSync("src/pages/Lesson/LessonPage.tsx", "utf8");
const provider = fs.readFileSync("src/learning/cloudflareVoiceProvider.ts", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const references = fs.readFileSync("worker/verifiedVoiceReferences.ts", "utf8");

const checks = [
  ["lesson sends resolved category", lesson.includes("category: current.category")],
  ["lesson sends resolved session", lesson.includes("sessionId: current.sessionId")],
  ["provider forwards category", provider.includes('form.set("category", request.category)')],
  ["provider forwards session", provider.includes('form.set("sessionId", request.sessionId)')],
  ["worker reads category", worker.includes('form.get("category")')],
  ["worker reads session", worker.includes('form.get("sessionId")')],
  ["worker validates controlled tuple", worker.includes("matchesVerifiedVoiceReference(category as ExerciseCategory, sessionId, itemId, referenceText)")],
  ["voice references use generated policy", references.includes("controlledObservationPolicyForAttempt")],
  ["voice references require optional policy", references.includes('policy?.voice !== "optional"')],
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`Voice policy wiring invariant failed: ${label}`);
}

console.log("Controlled voice policy wiring checks passed.");
