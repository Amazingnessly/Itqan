import { matchesVerifiedVoiceReference } from "./verifiedVoiceReferences";

export interface Env {
  ASSETS: Fetcher;
}

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_REFERENCE_CHARS = 512;
const MAX_ITEM_ID_CHARS = 128;
const ALLOWED_AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"]);

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

export async function handleVoiceAssessment(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) return json({ error: "multipart/form-data required" }, 415);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "invalid multipart form" }, 400);
  }

  const itemId = form.get("itemId");
  const referenceText = form.get("referenceText");
  const audio = form.get("audio");
  if (typeof itemId !== "string" || typeof referenceText !== "string" || !(audio instanceof File)) {
    return json({ error: "itemId, referenceText and audio are required" }, 400);
  }

  const normalizedItemId = itemId.trim();
  if (!normalizedItemId || normalizedItemId.length > MAX_ITEM_ID_CHARS) return json({ error: "invalid itemId" }, 400);
  if (!referenceText || referenceText.length > MAX_REFERENCE_CHARS) return json({ error: "invalid referenceText" }, 400);
  if (normalizedItemId !== itemId) return json({ error: "invalid itemId" }, 400);
  if (!matchesVerifiedVoiceReference(itemId, referenceText)) return json({ error: "unverified reference" }, 400);
  if (audio.size === 0) return json({ error: "empty audio" }, 400);
  if (audio.size > MAX_AUDIO_BYTES) return json({ error: "audio too large" }, 413);
  if (audio.type && !ALLOWED_AUDIO_TYPES.has(audio.type.toLowerCase())) return json({ error: "unsupported audio type" }, 415);

  // Deliberately conservative until an Arabic speech provider is configured and
  // validated against Itqān's controlled corpus. The browser safety gate treats
  // this as an observation only; it cannot change mastery or unlock decisions.
  return json({
    provider: "cloudflare-unconfigured",
    recognized: false,
    confidence: 0,
    notes: "Voice provider not configured; keep manual self-check authoritative.",
  });
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/voice-assessment") {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, { allow: "POST" });
    return handleVoiceAssessment(request);
  }
  return env.ASSETS.fetch(request);
}

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>;
