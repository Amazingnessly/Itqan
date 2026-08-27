import assert from "node:assert/strict";
import { handleRequest } from "../worker/index";
import { buildVerifiedVoiceReferences, VERIFIED_VOICE_REFERENCES } from "../worker/verifiedVoiceReferences";

const firstVerified = VERIFIED_VOICE_REFERENCES.entries().next().value as [string, string] | undefined;
assert.ok(firstVerified, "expected at least one verified voice reference");
const [itemId, referenceText] = firstVerified;

const eligibleFixture = {
  id: "fixture-a",
  arabicExact: "reference-a",
  active: true,
  eligibleForActiveLesson: true,
  integrity: { normalizationApplied: false },
  verification: { visualPass1: true, visualPass2: true, ambiguous: false },
};
assert.equal(buildVerifiedVoiceReferences([{ items: [eligibleFixture] }]).get("fixture-a"), "reference-a");
assert.equal(buildVerifiedVoiceReferences([{ items: [{ ...eligibleFixture, integrity: { normalizationApplied: true } }] }]).size, 0);
assert.throws(() => buildVerifiedVoiceReferences([{ items: [eligibleFixture, eligibleFixture] }]), /Duplicate verified content id/);

const env = {
  ASSETS: {
    fetch: async () => new Response("asset", { status: 200 }),
  },
};

function validForm(overrides: { itemId?: string; referenceText?: string; audio?: File } = {}) {
  const form = new FormData();
  form.set("itemId", overrides.itemId ?? itemId);
  form.set("referenceText", overrides.referenceText ?? referenceText);
  form.set("audio", overrides.audio ?? new File(["voice"], "voice.webm", { type: "audio/webm" }));
  return form;
}

async function api(form: FormData, method = "POST") {
  return handleRequest(new Request("https://itqan.test/api/voice-assessment", { method, body: method === "POST" ? form : undefined }), env as never);
}

{
  const response = await handleRequest(new Request("https://itqan.test/api/voice-assessment", { method: "GET" }), env as never);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}

{
  const response = await handleRequest(new Request("https://itqan.test/api/voice-assessment", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), env as never);
  assert.equal(response.status, 415);
}

{
  const response = await api(validForm({ itemId: "unknown-controlled-item" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "unverified reference" });
}

{
  const response = await api(validForm({ referenceText: `${referenceText} ` }));
  assert.equal(response.status, 400, "reference text must match byte-for-byte without trimming");
}

{
  const response = await api(validForm({ audio: new File([], "empty.webm", { type: "audio/webm" }) }));
  assert.equal(response.status, 400);
}

{
  const response = await api(validForm({ audio: new File(["voice"], "voice.txt", { type: "text/plain" }) }));
  assert.equal(response.status, 415);
}

{
  const response = await api(validForm());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  const body = await response.json() as { provider?: string; recognized?: boolean; confidence?: number };
  assert.equal(body.provider, "cloudflare-unconfigured");
  assert.equal(body.recognized, false);
  assert.equal(body.confidence, 0);
}

console.log("Voice Worker behavior checks passed.");
