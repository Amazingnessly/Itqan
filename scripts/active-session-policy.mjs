const arabicPattern = /[\u0600-\u06ff]/u;

export const ACTIVE_SESSION_SCHEMA_VERSION = "0.1";

export function validateActiveSessionPolicy({ category, blueprint, manifest, activation }) {
  if (activation?.schemaVersion !== ACTIVE_SESSION_SCHEMA_VERSION) {
    throw new Error(`Unsupported active-session schema: ${String(activation?.schemaVersion)}.`);
  }

  const allowlisted = activation[category];
  if (!Array.isArray(allowlisted)) {
    throw new Error(`Missing active-session list for ${category}.`);
  }
  if (new Set(allowlisted).size !== allowlisted.length) {
    throw new Error(`Duplicate active session in ${category}.`);
  }
  if (allowlisted.some((sessionId) => typeof sessionId !== "string" || !sessionId || arabicPattern.test(sessionId))) {
    throw new Error(`Invalid active-session id in ${category}.`);
  }
  if (blueprint?.category !== category) {
    throw new Error(`Blueprint category mismatch for ${category}.`);
  }

  const sessions = blueprint.sessions ?? [];
  const expectedPrefix = sessions.slice(0, allowlisted.length).map((session) => session.id);
  if (JSON.stringify(allowlisted) !== JSON.stringify(expectedPrefix)) {
    throw new Error(`Active sessions for ${category} must be a contiguous prefix: ${JSON.stringify(allowlisted)}.`);
  }

  const items = new Map((manifest.items ?? []).map((item) => [item.id, item]));
  const verifiedPages = new Set(manifest.sourceControl?.verifiedPdfPages ?? []);
  for (const sessionId of allowlisted) {
    const session = sessions.find((entry) => entry.id === sessionId);
    if (!session || !(session.interactions ?? []).length) {
      throw new Error(`Invalid active session ${category}/${sessionId}.`);
    }
    for (const interaction of session.interactions) {
      const item = items.get(interaction.itemId);
      if (
        !item ||
        item.active !== true ||
        item.source?.sourceId !== manifest.sourceControl?.canonicalSourceId ||
        !verifiedPages.has(item.source?.pdfPage) ||
        item.verification?.visualPass1 !== true ||
        item.verification?.visualPass2 !== true ||
        item.verification?.ambiguous !== false ||
        item.eligibleForActiveLesson !== true ||
        !item.allowedExerciseTypes?.includes(category) ||
        item.integrity?.normalizationApplied !== false ||
        typeof item.integrity?.utf8Sha256 !== "string" ||
        item.integrity.utf8Sha256.length !== 64
      ) {
        throw new Error(`Unsafe active item ${interaction.itemId} in ${category}/${sessionId}.`);
      }
    }
  }

  return allowlisted;
}