import type { ExerciseCategory } from "../src/learning/types";
import { matchesVerifiedVoiceReference } from "./verifiedVoiceReferences";

type WorkersAiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

export interface Env {
  ASSETS: Fetcher;
  AI?: WorkersAiBinding;
}

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_REFERENCE_CHARS = 512;
const MAX_ITEM_ID_CHARS = 128;
const MAX_SESSION_ID_CHARS = 128;
const CATEGORIES = new Set<ExerciseCategory>([
  "reading_units",
  "vowels_sukun",
  "shaddah",
  "article_al",
  "linking",
  "fluent_reading",
]);
const ALLOWED_AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"]);
const ALLOWED_LOCALE_HINTS = new Set(["ar-SA", "ar-EG"]);
const VOICE_MODEL = "@cf/openai/whisper-large-v3-turbo";

const API_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), geolocation=(), payment=()",
  "cross-origin-resource-policy": "same-origin",
} as const;

const json = (body: unknown, status = 200, extraHeaders?: HeadersInit) => new Response(JSON.stringify(body), {
  status,
  headers: { ...API_HEADERS, ...extraHeaders },
});

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function transcriptionText(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const text = (result as Record<string, unknown>).text;
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function handleVoiceAssessment(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) return json({ error: "multipart/form-data required" }, 415);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "invalid multipart form" }, 400);
  }

  const category = form.get("category");
  const sessionId = form.get("sessionId");
  const itemId = form.get("itemId");
  const referenceText = form.get("referenceText");
  const localeHint = form.get("localeHint");
  const audio = form.get("audio");
  if (
    typeof category !== "string" ||
    typeof sessionId !== "string" ||
    typeof itemId !== "string" ||
    typeof referenceText !== "string" ||
    !(audio instanceof File)
  ) {
    return json({ error: "category, sessionId, itemId, referenceText and audio are required" }, 400);
  }

  if (!CATEGORIES.has(category as ExerciseCategory)) return json({ error: "invalid category" }, 400);
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId || normalizedSessionId.length > MAX_SESSION_ID_CHARS || normalizedSessionId !== sessionId) {
    return json({ error: "invalid sessionId" }, 400);
  }
  const normalizedItemId = itemId.trim();
  if (!normalizedItemId || normalizedItemId.length > MAX_ITEM_ID_CHARS) return json({ error: "invalid itemId" }, 400);
  if (!referenceText || referenceText.length > MAX_REFERENCE_CHARS) return json({ error: "invalid referenceText" }, 400);
  if (normalizedItemId !== itemId) return json({ error: "invalid itemId" }, 400);
  if (!matchesVerifiedVoiceReference(category as ExerciseCategory, sessionId, itemId, referenceText)) {
    return json({ error: "unverified voice request" }, 400);
  }
  if (localeHint !== null && (typeof localeHint !== "string" || !ALLOWED_LOCALE_HINTS.has(localeHint))) {
    return json({ error: "unsupported localeHint" }, 400);
  }
  if (audio.size === 0) return json({ error: "empty audio" }, 400);
  if (audio.size > MAX_AUDIO_BYTES) return json({ error: "audio too large" }, 413);
  if (audio.type && !ALLOWED_AUDIO_TYPES.has(audio.type.toLowerCase())) return json({ error: "unsupported audio type" }, 415);
  if (!env.AI) return json({ error: "voice provider unavailable" }, 503);

  try {
    const audioBase64 = arrayBufferToBase64(await audio.arrayBuffer());
    const result = await env.AI.run(VOICE_MODEL, {
      audio: audioBase64,
      task: "transcribe",
      language: "ar",
      vad_filter: true,
      condition_on_previous_text: false,
    });
    const transcript = transcriptionText(result);
    if (!transcript) return json({ error: "voice transcription unavailable" }, 503);

    // Observational only. We deliberately do not compare the transcript against
    // the controlled reference, assign a score, diagnose a reading rule, or mark
    // validatedByItqan. Manual Exact / À reprendre remains authoritative until
    // the speech layer is separately validated against Itqān's controlled corpus.
    return json({
      provider: "cloudflare-workers-ai-whisper-large-v3-turbo",
      recognized: true,
    });
  } catch {
    return json({ error: "voice transcription unavailable" }, 503);
  }
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/voice-assessment") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { allow: "POST" });
    return handleVoiceAssessment(request, env);
  }
  return env.ASSETS.fetch(request);
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>;
