import fs from "node:fs";

const path = "src/pages/Lesson/LessonPage.tsx";
let text = fs.readFileSync(path, "utf8");

const importNeedle = "  nextSessionId,\n  saveLearnerState,";
const importReplacement = "  nextSessionId,\n  isCategoryAvailableForActiveLesson,\n  saveLearnerState,";
if (!text.includes(importNeedle)) throw new Error("LessonPage import contract changed.");
text = text.replace(importNeedle, importReplacement);

const statusNeedle = "  const nextUnlocked = nextCategory ? isCategoryUnlocked(nextCategory, learner) : false;\n  const skill = learner.skills[category];";
const statusReplacement = "  const nextUnlocked = nextCategory ? isCategoryUnlocked(nextCategory, learner) : false;\n  const nextAvailable = nextCategory ? isCategoryAvailableForActiveLesson(nextCategory, learner) : false;\n  const skill = learner.skills[category];";
if (!text.includes(statusNeedle)) throw new Error("LessonPage next-category status contract changed.");
text = text.replace(statusNeedle, statusReplacement);

const completionNeedle = '  if (phase === "complete") return <main className="lesson-page lesson-complete"><div className="lesson-complete__seal"><Sparkles size={22} /></div><span className="section-kicker">Séance {sessionNumber} terminée</span><h1>{nextUnlocked ? "Une nouvelle étape s’ouvre." : "Une étape consolidée."}</h1><p>{nextUnlocked && nextCategory ? `${CATEGORY_LABELS[nextCategory]} est maintenant accessible.` : `${CATEGORY_LABELS[category]} reste au niveau ${LEVEL_SYMBOLS[skill.level]} ${LEVEL_LABELS[skill.level]}. Continue jusqu’à ce que la maîtrise soit stable.`}</p><div className="lesson-summary-grid"><div><span>Lectures exactes</span><strong>{sessionCorrect} / {resolved.length}</strong></div><div><span>Reprises</span><strong>{sessionRetries}</strong></div><div><span>Temps de lecture</span><strong>{sessionReadingMs > 0 ? `${Math.max(1, Math.round(sessionReadingMs / 1000))} s` : "Non mesuré"}</strong></div></div><div className="lesson-principle"><ShieldCheck size={18} /><span>Le temps est observé. Il ne remplace jamais l’exactitude.</span></div><button className="primary-cta" type="button" onClick={onComplete}>{nextUnlocked ? "Voir la suite" : "Continuer"}</button></main>;';
const completionReplacement = '  if (phase === "complete") return <main className="lesson-page lesson-complete"><div className="lesson-complete__seal"><Sparkles size={22} /></div><span className="section-kicker">Séance {sessionNumber} terminée</span><h1>{nextAvailable ? "Une nouvelle étape s’ouvre." : nextUnlocked ? "Maîtrise confirmée." : "La précision progresse."}</h1><p>{nextAvailable && nextCategory ? `${CATEGORY_LABELS[nextCategory]} est maintenant accessible.` : nextUnlocked && nextCategory ? `${CATEGORY_LABELS[nextCategory]} est prête pédagogiquement, mais son contenu contrôlé reste en attente.` : `${CATEGORY_LABELS[category]} reste au niveau ${LEVEL_SYMBOLS[skill.level]} ${LEVEL_LABELS[skill.level]}. Continue jusqu’à ce que la maîtrise soit stable.`}</p><div className="lesson-summary-grid"><div><span>Lectures exactes</span><strong>{sessionCorrect} / {resolved.length}</strong></div><div><span>Reprises</span><strong>{sessionRetries}</strong></div><div><span>Temps de lecture</span><strong>{sessionReadingMs > 0 ? `${Math.max(1, Math.round(sessionReadingMs / 1000))} s` : "Non mesuré"}</strong></div></div><div className="lesson-principle"><ShieldCheck size={18} /><span>Le temps est observé. Il ne remplace jamais l’exactitude.</span></div><button className="primary-cta" type="button" onClick={onComplete}>{nextAvailable ? "Voir la suite" : "Continuer"}</button></main>;';
if (!text.includes(completionNeedle)) throw new Error("LessonPage completion contract changed.");
text = text.replace(completionNeedle, completionReplacement);

fs.writeFileSync(path, text, "utf8");
console.log("OK: lesson completion now distinguishes pedagogical unlock from runnable content.");
