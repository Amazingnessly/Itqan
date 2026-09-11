import fs from "node:fs";

const path = "src/pages/Lesson/LessonPage.tsx";
let text = fs.readFileSync(path, "utf8");

const importNeedle = 'import { CATEGORY_LABELS, LEVEL_LABELS, LEVEL_SYMBOLS } from "../../learning/progressInsights";';
const importReplacement = `${importNeedle}\nimport { INTERACTION_INSTRUCTIONS, METHOD_STEPS } from "./interactionInstructions";`;
const localInstructions = `const METHOD_STEPS = ["Voir", "Décomposer", "Prononcer", "Fluidifier"] as const;\nconst CAPTURE_FINALIZE_TIMEOUT_MS = 5000;\nconst instructions: Record<string, { kicker: (typeof METHOD_STEPS)[number]; title: string; hint: string }> = {\n  guided_scan: { kicker: "Voir", title: "Observe chaque unité avant de lire.", hint: "Ne devine pas la forme globale. Suis exactement ce qui est écrit." },\n  exact_read: { kicker: "Prononcer", title: "Lis exactement ce qui est affiché.", hint: "Garde chaque voyelle et chaque signe." },\n  unit_tracking: { kicker: "Décomposer", title: "Suis les unités dans l’ordre, puis lis.", hint: "Aucune unité ne doit disparaître pendant la lecture." },\n  oral_read: { kicker: "Prononcer", title: "Lis à voix haute, sans accélérer.", hint: "Une lecture lente et exacte vaut mieux qu’une lecture rapide et imprécise." },\n  delayed_recall: { kicker: "Voir", title: "Relis sans t’appuyer sur la mémoire.", hint: "Regarde à nouveau les signes : lis ce qui est là, pas ce que tu attends." },\n  mixed_exact_read: { kicker: "Fluidifier", title: "Garde la même précision dans ce nouveau contexte.", hint: "La fluidité n’est utile que si chaque signe reste exact." },\n};`;
const centralInstructions = `const CAPTURE_FINALIZE_TIMEOUT_MS = 5000;`;
const instructionNeedle = "  const instruction = useMemo(() => current ? instructions[current.interaction.mode] ?? instructions.exact_read : instructions.exact_read, [current]);";
const instructionReplacement = "  const instruction = useMemo(() => current ? INTERACTION_INSTRUCTIONS[current.interaction.mode] : INTERACTION_INSTRUCTIONS.exact_read, [current]);";

if (
  text.includes(importReplacement) &&
  !text.includes(localInstructions) &&
  text.includes(centralInstructions) &&
  text.includes(instructionReplacement)
) {
  console.log("OK: exhaustive interaction instructions already connected.");
  process.exit(0);
}

if (!text.includes(importNeedle)) throw new Error("LessonPage progress-insight import contract changed.");
text = text.replace(importNeedle, importReplacement);
if (!text.includes(localInstructions)) throw new Error("LessonPage local instruction contract changed.");
text = text.replace(localInstructions, centralInstructions);
if (!text.includes(instructionNeedle)) throw new Error("LessonPage instruction selection contract changed.");
text = text.replace(instructionNeedle, instructionReplacement);

fs.writeFileSync(path, text, "utf8");
console.log("OK: LessonPage now uses exhaustive interaction instructions without a silent fallback.");
