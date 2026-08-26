import type { VoiceAssessmentProvider, VoiceAssessmentRequest, VoiceAssessmentResult } from "./voiceAssessment";

export type CloudflareVoiceProviderOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

function isVoiceAssessmentResult(value: unknown): value is VoiceAssessmentResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<VoiceAssessmentResult>;
  return typeof result.provider === "string" && typeof result.recognized === "boolean";
}

/**
 * Browser-side adapter for an Itqān-controlled Cloudflare endpoint.
 * The Worker is intentionally treated as an untrusted observation provider:
 * callers must still pass its result through assessVoiceSafely before using
 * any specific diagnosis.
 */
export class CloudflareVoiceAssessmentProvider implements VoiceAssessmentProvider {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CloudflareVoiceProviderOptions = {}) {
    this.endpoint = options.endpoint ?? "/api/voice-assessment";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async assess(request: VoiceAssessmentRequest): Promise<VoiceAssessmentResult> {
    const form = new FormData();
    form.set("itemId", request.itemId);
    form.set("referenceText", request.referenceText);
    if (request.localeHint) form.set("localeHint", request.localeHint);
    form.set("audio", request.audio, "reading.webm");

    const response = await this.fetchImpl(this.endpoint, { method: "POST", body: form });
    if (!response.ok) throw new Error(`Voice assessment endpoint failed (${response.status}).`);
    const payload: unknown = await response.json();
    if (!isVoiceAssessmentResult(payload)) throw new Error("Invalid voice assessment response.");
    return payload;
  }
}
