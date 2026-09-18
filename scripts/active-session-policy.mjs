const arabicPattern = /[\u0600-\u06ff]/u;

export const ACTIVE_SESSION_SCHEMA_VERSION = "0.1";

const READING_UNITS_FOUNDATION_ITEMS = new Set([
  "S110-P003-001",
  "S110-P003-006",
  "S110-P021-002",
]);

const ARTICLE_QAMARIYYAH_SESSIONS = new Set([
  "ARTICLE_AL-B02-S01",
  "ARTICLE_AL-B02-S02",
  "ARTICLE_AL-B02-S03",
]);

const ARTICLE_SHAMSIYYAH_SESSIONS = new Set([
  "ARTICLE_AL-B02-S04",
  "ARTICLE_AL-B02-S05",
  "ARTICLE_AL-B02-S06",
]);

function assertReadingUnitsSessionShape(session) {
  const itemIds = (session.interactions ?? []).map((interaction) => interaction.itemId);
  const distinct = new Set(itemIds);
  if (itemIds.length !== READING_UNITS_FOUNDATION_ITEMS.size) {
    throw new Error(`Pedagogical scope violation: reading_units/${session.id} must contain exactly ${READING_UNITS_FOUNDATION_ITEMS.size} foundation interactions.`);
  }
  if (distinct.size !== itemIds.length) {
    throw new Error(`Pedagogical scope violation: reading_units/${session.id} repeats a foundation item within the same session.`);
  }
  for (const itemId of READING_UNITS_FOUNDATION_ITEMS) {
    if (!distinct.has(itemId)) {
      throw new Error(`Pedagogical scope violation: reading_units/${session.id} does not cover the full approved foundation item set.`);
    }
  }
}

function assertReadingUnitsFoundationScope(item, interaction, sessionId) {
  if (!READING_UNITS_FOUNDATION_ITEMS.has(interaction.itemId)) {
    throw new Error(`Pedagogical scope violation: ${interaction.itemId} in reading_units/${sessionId} is outside the explicit foundation item set.`);
  }
  if (/\s/u.test(item.arabicExact ?? "")) {
    throw new Error(`Pedagogical scope violation: ${interaction.itemId} in reading_units/${sessionId} is not an isolated reading unit.`);
  }
  if ((item.articleClassObserved ?? []).length > 0) {
    throw new Error(`Pedagogical scope violation: ${interaction.itemId} in reading_units/${sessionId} introduces article behavior before the article stage.`);
  }
  if ((item.focusMarksObserved ?? []).includes("shaddah")) {
    throw new Error(`Pedagogical scope violation: ${interaction.itemId} in reading_units/${sessionId} introduces shaddah before the shaddah stage.`);
  }
}

function assertArticlePhaseScope(item, interaction, sessionId) {
  const observed = item.articleClassObserved ?? [];
  if (ARTICLE_QAMARIYYAH_SESSIONS.has(sessionId)) {
    if (observed.length !== 1 || observed[0] !== "qamariyyah") {
      throw new Error(`Pedagogical scope violation: ${interaction.itemId} in article_al/${sessionId} is not qamariyyah-only.`);
    }
    if ((item.focusMarksObserved ?? []).includes("shaddah")) {
      throw new Error(`Pedagogical scope violation: ${interaction.itemId} in article_al/${sessionId} introduces shaddah before the shaddah stage.`);
    }
    return;
  }

  if (ARTICLE_SHAMSIYYAH_SESSIONS.has(sessionId)) {
    if (observed.length !== 1 || observed[0] !== "shamsiyyah") {
      throw new Error(`Pedagogical scope violation: ${interaction.itemId} in article_al/${sessionId} is not shamsiyyah-only.`);
    }
    if (!(item.focusMarksObserved ?? []).includes("shaddah")) {
      throw new Error(`Pedagogical scope violation: ${interaction.itemId} in article_al/${sessionId} lacks the observed shaddah required for the post-shaddah phase.`);
    }
    return;
  }

  throw new Error(`Pedagogical scope violation: active article session ${sessionId} is not assigned to a controlled article phase.`);
}

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
    if (category === "reading_units") {
      assertReadingUnitsSessionShape(session);
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
      if (category === "reading_units") {
        assertReadingUnitsFoundationScope(item, interaction, sessionId);
      }
      if (category === "article_al") {
        assertArticlePhaseScope(item, interaction, sessionId);
      }
    }
  }

  return allowlisted;
}
