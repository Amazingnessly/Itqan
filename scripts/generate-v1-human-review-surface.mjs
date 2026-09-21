import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "docs/generated/V1_HUMAN_REVIEW_SURFACE.md");

const CATEGORY_RESOURCES = Object.freeze({
  reading_units: ["public/content/blueprints/units-batch01.json", "public/content/verified/s110-batch01.json"],
  vowels_sukun: ["public/content/blueprints/vowels_sukun-batch02.json", "public/content/verified/s110-batch02.json"],
  article_al: ["public/content/blueprints/article_al-batch02.json", "public/content/verified/s110-batch02.json"],
  shaddah: ["public/content/blueprints/shaddah-batch02.json", "public/content/verified/s110-batch02.json"],
  linking: ["public/content/blueprints/linking-batch02.json", "public/content/verified/s110-batch02.json"],
  fluent_reading: ["public/content/blueprints/fluent_reading-batch02.json", "public/content/verified/s110-batch02.json"],
});

const STAGE_LABELS = Object.freeze({
  reading_units: "1 — reading_units",
  vowels_sukun: "2 — vowels_sukun",
  shaddah: "4 — shaddah",
  linking: "6 — linking",
  fluent_reading: "7 — fluent_reading",
});

const REVIEW_STAGES = Object.freeze([
  { category: "reading_units", label: STAGE_LABELS.reading_units },
  { category: "vowels_sukun", label: STAGE_LABELS.vowels_sukun },
  { category: "article_al", label: "3 — article_al (qamariyyah)", sessionNumbers: [1, 2, 3] },
  { category: "shaddah", label: STAGE_LABELS.shaddah },
  { category: "article_al", label: "5 — article_al (shamsiyyah)", sessionNumbers: [4, 5, 6] },
  { category: "linking", label: STAGE_LABELS.linking },
  { category: "fluent_reading", label: STAGE_LABELS.fluent_reading },
]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function assertReviewable(item, category, itemId) {
  if (!item) throw new Error(`Missing controlled item ${itemId}`);
  if (item.verification?.visualPass1 !== true || item.verification?.visualPass2 !== true) {
    throw new Error(`${itemId} does not have both visual passes`);
  }
  if (item.verification?.ambiguous !== false) throw new Error(`${itemId} is ambiguous`);
  if (!item.allowedExerciseTypes?.includes(category)) throw new Error(`${itemId} is not authorized for ${category}`);
  if (item.eligibleForActiveLesson !== true || item.active !== true) throw new Error(`${itemId} is not active and eligible`);
  if (item.integrity?.normalizationApplied !== false) throw new Error(`${itemId} has normalization applied`);
  if (!item.source?.sourceId || !item.source?.file || !Number.isInteger(item.source?.pdfPage) || !Number.isInteger(item.source?.printedPage)) {
    throw new Error(`${itemId} has incomplete source provenance`);
  }
  const expectedHash = crypto.createHash("sha256").update(item.arabicExact, "utf8").digest("hex");
  if (item.integrity?.utf8Sha256 !== expectedHash) throw new Error(`${itemId} has an integrity hash mismatch`);
}

function uniqueMap(values, label) {
  const result = new Map();
  for (const value of values) {
    if (!value?.id) throw new Error(`${label} has an entry without an id`);
    if (result.has(value.id)) throw new Error(`${label} has duplicate id ${value.id}`);
    result.set(value.id, value);
  }
  return result;
}

function evidenceState(item) {
  const evidence = item.verification?.evidence;
  if (!evidence?.full || !evidence?.crop) return { complete: false };
  if (evidence.full === evidence.crop) throw new Error(`${item.id} must have distinct page and zoom evidence`);
  for (const relativePath of [evidence.full, evidence.crop]) {
    if (!/^evidence\/[A-Za-z0-9._-]+$/.test(relativePath)) {
      throw new Error(`${item.id} has an unsafe evidence path ${relativePath}`);
    }
    const absolutePath = path.join(root, "public/content", relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new Error(`${item.id} points to missing evidence ${relativePath}`);
    }
  }
  return { complete: true, ...evidence };
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function buildHumanReviewSurface({ loadJson = readJson } = {}) {
  const activation = loadJson("public/content/activation/active-sessions.json");
  const lines = [
    "# Surface de revue humaine V1 — 21 sessions actives",
    "",
    "> Fichier généré : ne pas le modifier à la main. Exécuter `npm run generate:v1-human-review-surface`.",
    "> Les formes arabes ci-dessous sont copiées octet pour octet depuis `arabicExact` des manifestes contrôlés ; le générateur n'effectue aucune normalisation.",
    "",
    "Cette surface est une aide de revue, pas une approbation linguistique. Le verdict traçable par session reste dans `docs/V1_ARABIC_HUMAN_REVIEW.md`.",
    "",
    "## Protocole",
    "",
    "Pour chaque interaction, comparer la forme affichée aux deux preuves visuelles de la page source, puis vérifier le geste de lecture et le mode. Respecter **VOIR → DÉCOMPOSER → PRONONCER → FLUIDIFIER** et la précision avant la fluidité. Reporter le verdict, l'identité qualifiée et la référence de preuve dans le registre principal. Ne jamais corriger le texte dans ce fichier généré.",
    "",
  ];

  let sessionCount = 0;
  let interactionCount = 0;
  const uniqueItems = new Set();
  const missingEvidenceItems = new Set();
  const missingEvidenceSessions = new Set();
  const emittedSessions = new Set();
  const expectedSessions = new Set();

  for (const [category, sessionIds] of Object.entries(activation)) {
    if (category === "schemaVersion") continue;
    if (!Object.hasOwn(CATEGORY_RESOURCES, category) || !Array.isArray(sessionIds)) {
      throw new Error(`Unknown or invalid activation category ${category}`);
    }
    for (const sessionId of sessionIds) {
      const key = `${category}:${sessionId}`;
      if (expectedSessions.has(key)) throw new Error(`Duplicate active session ${key}`);
      expectedSessions.add(key);
    }
  }

  for (const stage of REVIEW_STAGES) {
    const { category } = stage;
    const resources = CATEGORY_RESOURCES[category];
    const [blueprintPath, manifestPath] = resources;
    const blueprint = loadJson(blueprintPath);
    const manifest = loadJson(manifestPath);
    const items = uniqueMap(manifest.items, manifestPath);
    const sessions = uniqueMap(blueprint.sessions, blueprintPath);

    const activeSessions = (activation[category] ?? []).filter((sessionId) => {
      if (!stage.sessionNumbers) return true;
      return stage.sessionNumbers.includes(Number(sessionId.match(/S(\d+)$/)?.[1]));
    });
    for (const sessionId of activeSessions) {
      const sessionKey = `${category}:${sessionId}`;
      if (emittedSessions.has(sessionKey)) throw new Error(`Active session emitted more than once: ${sessionKey}`);
      emittedSessions.add(sessionKey);
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Active session ${sessionId} is absent from ${blueprintPath}`);
      sessionCount += 1;
      lines.push(`## ${sessionId}`, "");
      lines.push(`- Étape pédagogique : \`${stage.label}\``);
      lines.push(`- Chaîne contrôlée : \`${blueprintPath}\` → \`${manifestPath}\``);
      lines.push(`- Interactions déclarées : \`${session.interactionCount}\``, "");
      lines.push("| Ordre | Mode | itemId | arabe exact contrôlé | Source | Intégrité | Passes / ambiguïté | Précision · chrono · voix | Preuves |", "| ---: | --- | --- | --- | --- | --- | --- | --- | --- |");

      if (session.interactionCount !== session.interactions.length) {
        throw new Error(`${sessionId} interactionCount does not match its interactions`);
      }
      session.interactions.forEach((interaction, index) => {
        if (interaction.order !== index + 1) throw new Error(`${sessionId} has a non-canonical interaction order`);
        const item = items.get(interaction.itemId);
        assertReviewable(item, category, interaction.itemId);
        interactionCount += 1;
        uniqueItems.add(item.id);
        const evidence = evidenceState(item);
        if (!evidence.complete) {
          missingEvidenceItems.add(item.id);
          missingEvidenceSessions.add(sessionKey);
        }
        const evidenceLinks = evidence.complete
          ? `[page](../../public/content/${evidence.full}) · [zoom](../../public/content/${evidence.crop})`
          : `**PREUVES VISUELLES MANQUANTES — REVUE BLOQUÉE** (scan déclaré : \`${escapeTable(item.source.file)}\`, p. PDF ${item.source.pdfPage})`;
        lines.push(`| ${interaction.order} | \`${interaction.mode}\` | \`${item.id}\` | <bdi dir="rtl" lang="ar">${escapeTable(item.arabicExact)}</bdi> | \`${item.source.sourceId}\` · PDF ${item.source.pdfPage} · imprimée ${item.source.printedPage} | \`${item.integrity.utf8Sha256}\` | oui · oui · non | ${interaction.precisionRequired ? "requise" : "non"} · \`${interaction.timing}\` · \`${interaction.voice}\` | ${evidenceLinks} |`);
      });
      lines.push("");
    }
  }

  const missingSessions = [...expectedSessions].filter((key) => !emittedSessions.has(key));
  const extraSessions = [...emittedSessions].filter((key) => !expectedSessions.has(key));
  if (missingSessions.length || extraSessions.length) {
    throw new Error(`Review coverage mismatch; missing: ${missingSessions.join(", ") || "none"}; extra: ${extraSessions.join(", ") || "none"}`);
  }
  lines.splice(5, 0,
    `> Couverture générée : **${sessionCount} sessions**, **${interactionCount} interactions**, **${uniqueItems.size} items contrôlés distincts**.`,
    `> Preuves visuelles : **${uniqueItems.size - missingEvidenceItems.size} items avec deux liens**, **${missingEvidenceItems.size} items bloqués faute de liens**. Une ligne bloquée ne peut pas être validée par la revue humaine.`,
  );
  if (sessionCount !== 21 || emittedSessions.size !== 21) throw new Error(`Expected 21 unique active sessions, found ${emittedSessions.size}`);
  return {
    text: `${lines.join("\n")}\n`,
    sessionCount,
    interactionCount,
    uniqueItemCount: uniqueItems.size,
    missingEvidenceItemCount: missingEvidenceItems.size,
    missingEvidenceSessions: [...missingEvidenceSessions],
  };
}

function runCli() {
  const result = buildHumanReviewSurface();
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
    if (current !== result.text) throw new Error("Generated human-review surface is stale; run npm run generate:v1-human-review-surface");
    console.log(`OK: generated review surface covers ${result.sessionCount} sessions and ${result.interactionCount} interactions.`);
    return;
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, result.text);
  console.log(`Generated ${path.relative(root, outputPath)} (${result.sessionCount} sessions, ${result.interactionCount} interactions).`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try { runCli(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
