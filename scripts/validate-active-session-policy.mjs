import fs from "node:fs";
import path from "node:path";

const base = process.cwd();
const catalogText = fs.readFileSync(path.join(base, "src/learning/categoryCatalog.ts"), "utf8");
const activation = JSON.parse(fs.readFileSync(path.join(base, "public/content/activation/active-sessions.json"), "utf8"));
const categoryPattern = /(reading_units|vowels_sukun|shaddah|article_al|linking|fluent_reading):\s*\{[\s\S]*?manifestUrl:\s*"([^"]+)"[\s\S]*?blueprintUrl:\s*"([^"]+)"/g;
const arabicPattern = /[\u0600-\u06ff]/u;
const resources = [];
let match;
while ((match = categoryPattern.exec(catalogText)) !== null) {
  resources.push({ category: match[1], manifestUrl: match[2], blueprintUrl: match[3] });
}

if (resources.length !== 6) throw new Error(`Expected 6 category resources, found ${resources.length}.`);
if (activation.schemaVersion !== "0.1") throw new Error(`Unsupported active-session schema: ${activation.schemaVersion}.`);

for (const { category, manifestUrl, blueprintUrl } of resources) {
  const allowlisted = activation[category];
  if (!Array.isArray(allowlisted)) throw new Error(`Missing active-session list for ${category}.`);
  if (new Set(allowlisted).size !== allowlisted.length) throw new Error(`Duplicate active session in ${category}.`);
  if (allowlisted.some((sessionId) => typeof sessionId !== "string" || !sessionId || arabicPattern.test(sessionId))) {
    throw new Error(`Invalid active-session id in ${category}.`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(base, manifestUrl.replace(/^\//, "public/")), "utf8"));
  const blueprint = JSON.parse(fs.readFileSync(path.join(base, blueprintUrl.replace(/^\//, "public/")), "utf8"));
  if (blueprint.category !== category) throw new Error(`Blueprint category mismatch for ${category}.`);

  const expectedPrefix = (blueprint.sessions ?? []).slice(0, allowlisted.length).map((session) => session.id);
  if (JSON.stringify(allowlisted) !== JSON.stringify(expectedPrefix)) {
    throw new Error(`Active sessions for ${category} must be a contiguous prefix: ${JSON.stringify(allowlisted)}.`);
  }

  const items = new Map((manifest.items ?? []).map((item) => [item.id, item]));
  const verifiedPages = new Set(manifest.sourceControl?.verifiedPdfPages ?? []);
  for (const sessionId of allowlisted) {
    const session = blueprint.sessions?.find((entry) => entry.id === sessionId);
    if (!session || !(session.interactions ?? []).length) throw new Error(`Invalid active session ${category}/${sessionId}.`);
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
}

console.log("OK: every explicitly active session is sequential and backed only by double-verified controlled items.");
