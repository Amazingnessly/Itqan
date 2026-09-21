import fs from "node:fs";
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
  if (!/^[0-9a-f]{64}$/.test(item.integrity?.utf8Sha256 ?? "")) throw new Error(`${itemId} has no valid integrity hash`);
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function buildHumanReviewSurface() {
  const activation = readJson("public/content/activation/active-sessions.json");
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

  for (const stage of REVIEW_STAGES) {
    const { category } = stage;
    const resources = CATEGORY_RESOURCES[category];
    const [blueprintPath, manifestPath] = resources;
    const blueprint = readJson(blueprintPath);
    const manifest = readJson(manifestPath);
    const items = new Map(manifest.items.map((item) => [item.id, item]));
    const sessions = new Map(blueprint.sessions.map((session) => [session.id, session]));

    const activeSessions = (activation[category] ?? []).filter((sessionId) => {
      if (!stage.sessionNumbers) return true;
      return stage.sessionNumbers.includes(Number(sessionId.match(/S(\d+)$/)?.[1]));
    });
    for (const sessionId of activeSessions) {
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
        const evidence = item.verification.evidence;
        const evidenceLinks = evidence
          ? `[page](../../public/content/${evidence.full}) · [zoom](../../public/content/${evidence.crop})`
          : `scan canonique \`${escapeTable(item.source.file)}\`, p. PDF ${item.source.pdfPage}`;
        lines.push(`| ${interaction.order} | \`${interaction.mode}\` | \`${item.id}\` | <bdi dir="rtl" lang="ar">${escapeTable(item.arabicExact)}</bdi> | \`${item.source.sourceId}\` · PDF ${item.source.pdfPage} · imprimée ${item.source.printedPage} | \`${item.integrity.utf8Sha256}\` | oui · oui · non | ${interaction.precisionRequired ? "requise" : "non"} · \`${interaction.timing}\` · \`${interaction.voice}\` | ${evidenceLinks} |`);
      });
      lines.push("");
    }
  }

  lines.splice(5, 0, `> Couverture générée : **${sessionCount} sessions**, **${interactionCount} interactions**, **${uniqueItems.size} items contrôlés distincts**.`);
  if (sessionCount !== 21) throw new Error(`Expected 21 active sessions, found ${sessionCount}`);
  return { text: `${lines.join("\n")}\n`, sessionCount, interactionCount, uniqueItemCount: uniqueItems.size };
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
