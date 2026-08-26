export interface Env {
  ASSETS: Fetcher;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

async function handleVoiceAssessment(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) return json({ error: "multipart/form-data required" }, 415);

  const form = await request.formData();
  const itemId = form.get("itemId");
  const referenceText = form.get("referenceText");
  const audio = form.get("audio");
  if (typeof itemId !== "string" || typeof referenceText !== "string" || !(audio instanceof File)) {
    return json({ error: "itemId, referenceText and audio are required" }, 400);
  }

  // Deliberately conservative until an Arabic speech provider is configured and
  // validated against Itqān's controlled corpus. The browser safety gate treats
  // this as an observation only; it cannot change mastery or unlock decisions.
  return json({
    provider: "cloudflare-unconfigured",
    recognized: false,
    confidence: 0,
    notes: "Voice provider not configured; keep manual self-check authoritative.",
  }, 200);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/voice-assessment") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return handleVoiceAssessment(request);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
