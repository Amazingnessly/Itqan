import type { VoiceAssessmentProvider, VoiceAssessmentRequest, VoiceAssessmentResult } from "./voiceAssessment";

export type CloudflareVoiceProviderOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"]);
const READING_ERROR_KINDS = new Set(["vowel", "sukun", "shaddah", "article", "linking", "other"]);
const isFiniteUnit = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const isOptionalCount = (value: unknown) => value === undefined || (Number.isInteger(value) && (value as number) >= 0);

function isVoiceAssessmentResult(value: unknown): value is VoiceAssessmentResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  if (typeof result.provider !== "string" || result.provider.length === 0 || typeof result.recognized !== "boolean") return false;
  if (result.overallScore !== undefined && !isFiniteUnit(result.overallScore)) return false;
  if (result.confidence !== undefined && !isFiniteUnit(result.confidence)) return false;
  if (!isOptionalCount(result.omissionCount) || !isOptionalCount(result.insertionCount) || !isOptionalCount(result.pronunciationIssueCount)) return false;
  if (result.specificReadingError !== undefined) {
    if (!result.specificReadingError || typeof result.specificReadingError !== "object") return false;
    const error = result.specificReadingError as Record<string, unknown>;
    if (typeof error.kind !== "string" || !READING_ERROR_KINDS.has(error.kind)) return false;
    if (!isFiniteUnit(error.confidence) || typeof error.validatedByItqan !== "boolean") return false;
  }
  return true;
}

function validateAudio(audio: Blob): void {
  if (audio.size === 0) throw new Error("Voice assessment audio is empty.");
  if (audio.size > MAX_AUDIO_BYTES) throw new Error("Voice assessment audio is too large.");
  if (audio.type && !ALLOWED_AUDIO_TYPES.has(audio.type.toLowerCase())) throw new Error("Voice assessment audio type is unsupported.");
}

function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
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
  private readonly timeoutMs: number;

  constructor(options: CloudflareVoiceProviderOptions = {}) {
    this.endpoint = options.endpoint ?? "/api/voice-assessment";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error("Voice assessment timeout must be positive.");
  }

  async assess(request: VoiceAssessmentRequest): Promise<VoiceAssessmentResult> {
    validateAudio(request.audio);

    const form = new FormData();
    form.set("itemId", request.itemId);
    form.set("referenceText", request.referenceText);
    if (request.localeHint) form.set("localeHint", request.localeHint);
    form.set("audio", request.audio, "reading.webm");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, { method: "POST", body: form, signal: controller.signal });
      if (!response.ok) throw new Error(`Voice assessment endpoint failed (${response.status}).`);
      if (!isJsonContentType(response.headers.get("content-type"))) throw new Error("Voice assessment endpoint returned a non-JSON response.");
      const payload: unknown = await response.json();
      if (!isVoiceAssessmentResult(payload)) throw new Error("Invalid voice assessment response.");
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }
}
