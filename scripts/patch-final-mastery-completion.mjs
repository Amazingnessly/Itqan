import fs from "node:fs";

const path = "src/pages/Lesson/LessonPage.tsx";
let text = fs.readFileSync(path, "utf8");

const skillBefore = '  const skill = learner.skills[category];\n  const timingAllowed = current ? mayObserveTiming(current.interaction, skill) : false;';
const skillAfter = '  const skill = learner.skills[category];\n  const finalMasteryConfirmed = !nextCategory && (skill.level === "mastery" || skill.level === "excellence");\n  const timingAllowed = current ? mayObserveTiming(current.interaction, skill) : false;';
const headingBefore = '<h1>{nextAvailable ? "Une nouvelle étape s’ouvre." : nextUnlocked ? "Maîtrise confirmée." : "La précision progresse."}</h1>';
const headingAfter = '<h1>{finalMasteryConfirmed ? "Parcours maîtrisé." : nextAvailable ? "Une nouvelle étape s’ouvre." : nextUnlocked ? "Maîtrise confirmée." : "La précision progresse."}</h1>';
const paragraphBefore = '<p>{nextAvailable && nextCategory ? `${CATEGORY_LABELS[nextCategory]} est maintenant accessible.` : nextUnlocked && nextCategory ? `${CATEGORY_LABELS[nextCategory]} est prête pédagogiquement, mais son contenu contrôlé reste en attente.` : `${CATEGORY_LABELS[category]} reste au niveau ${LEVEL_SYMBOLS[skill.level]} ${LEVEL_LABELS[skill.level]}. Continue jusqu’à ce que la maîtrise soit stable.`}</p>';
const paragraphAfter = '<p>{finalMasteryConfirmed ? `${CATEGORY_LABELS[category]} est stable au niveau ${LEVEL_SYMBOLS[skill.level]} ${LEVEL_LABELS[skill.level]}. Le parcours reste disponible pour entretenir la précision acquise.` : nextAvailable && nextCategory ? `${CATEGORY_LABELS[nextCategory]} est maintenant accessible.` : nextUnlocked && nextCategory ? `${CATEGORY_LABELS[nextCategory]} est prête pédagogiquement, mais son contenu contrôlé reste en attente.` : `${CATEGORY_LABELS[category]} reste au niveau ${LEVEL_SYMBOLS[skill.level]} ${LEVEL_LABELS[skill.level]}. Continue jusqu’à ce que la maîtrise soit stable.`}</p>';
const buttonBefore = '<button className="primary-cta" type="button" onClick={onComplete}>{nextAvailable ? "Voir la suite" : "Continuer"}</button>';
const buttonAfter = '<button className="primary-cta" type="button" onClick={onComplete}>{finalMasteryConfirmed ? "Retour au parcours" : nextAvailable ? "Voir la suite" : "Continuer"}</button>';

if (text.includes(skillAfter) && text.includes(headingAfter) && text.includes(paragraphAfter) && text.includes(buttonAfter)) {
  console.log("OK: final mastery completion already patched.");
  process.exit(0);
}
for (const [before, after, label] of [
  [skillBefore, skillAfter, "final mastery state"],
  [headingBefore, headingAfter, "completion heading"],
  [paragraphBefore, paragraphAfter, "completion paragraph"],
  [buttonBefore, buttonAfter, "completion button"],
]) {
  if (!text.includes(before)) throw new Error(`LessonPage ${label} contract changed.`);
  text = text.replace(before, after);
}
fs.writeFileSync(path, text, "utf8");
console.log("OK: LessonPage final mastery completion is explicit and truthful.");
