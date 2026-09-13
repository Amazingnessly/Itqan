import fs from "node:fs";

const lesson = fs.readFileSync("src/pages/Lesson/LessonPage.tsx", "utf8");
const provider = fs.readFileSync("src/learning/cloudflareVoiceProvider.ts", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const references = fs.readFileSync("worker/verifiedVoiceReferences.ts", "utf8");
const beginReadingStart = lesson.indexOf("async function beginReading");
const finishReadingStart = lesson.indexOf("async function finishReading", beginReadingStart);
const recordAttemptStart = lesson.indexOf("function recordAttempt", finishReadingStart);
const retryStart = lesson.indexOf("function retry", recordAttemptStart);
const beginReadingBlock = beginReadingStart >= 0 && finishReadingStart > beginReadingStart
  ? lesson.slice(beginReadingStart, finishReadingStart)
  : "";
const finishReadingBlock = finishReadingStart >= 0 && recordAttemptStart > finishReadingStart
  ? lesson.slice(finishReadingStart, recordAttemptStart)
  : "";
const recordAttemptBlock = recordAttemptStart >= 0 && retryStart > recordAttemptStart
  ? lesson.slice(recordAttemptStart, retryStart)
  : "";

const checks = [
  ["manual reading is the default action", lesson.includes("onClick={() => beginReading(false)}")],
  ["voice reading requires a separate explicit action", lesson.includes("onClick={() => beginReading(true)}")],
  ["voice request is scoped to optional interactions", beginReadingBlock.includes('captureVoice && current.interaction.voice === "optional"')],
  ["micro access follows explicit voice request", beginReadingBlock.includes("voiceCaptureRequestedRef.current = voiceRequested") && beginReadingBlock.includes("if (!voiceRequested)") && beginReadingBlock.includes("getUserMedia")],
  ["finish respects explicit voice opt-in", finishReadingBlock.includes("!voiceCaptureRequestedRef.current")],
  ["voice observation is persisted only after explicit opt-in", recordAttemptBlock.includes("voiceCaptureRequestedRef.current") && recordAttemptBlock.includes("attempted: true") && recordAttemptBlock.includes("providerScore: voiceGuidance?.result?.overallScore") && recordAttemptBlock.includes("providerConfidence: voiceGuidance?.result?.confidence")],
  ["voice observation reaches the guarded record boundary", recordAttemptBlock.includes("voice," ) && recordAttemptBlock.includes("engineRef.current.record")],
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
