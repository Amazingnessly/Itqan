const COMPLETED_SESSIONS_KEY = "itqan:completed-sessions:v1";

export function loadCompletedSessionIds(): string[] {
  try {
    const raw = localStorage.getItem(COMPLETED_SESSIONS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function markSessionCompleted(sessionId: string): string[] {
  const current = loadCompletedSessionIds();
  const next = Array.from(new Set([...current, sessionId]));
  localStorage.setItem(COMPLETED_SESSIONS_KEY, JSON.stringify(next));
  return next;
}
