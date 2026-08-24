import { ChevronLeft, ShieldCheck, Target } from "lucide-react";
import { PathNode } from "../../components/path/PathNode";
import { CATEGORY_ORDER } from "../../learning/categoryCatalog";
import { loadLearnerState } from "../../learning/persistence";
import { CATEGORY_LABELS, LEVEL_LABELS, LEVEL_SYMBOLS, accuracyPercent } from "../../learning/progressInsights";
import type { ExerciseCategory } from "../../learning/types";

const stages: Array<{ category: ExerciseCategory; x: number; y: number; labelSide: "left" | "right" }> = [
  { category: "reading_units", x: 31, y: 58, labelSide: "right" },
  { category: "vowels_sukun", x: 67, y: 168, labelSide: "left" },
  { category: "shaddah", x: 37, y: 282, labelSide: "right" },
  { category: "article_al", x: 69, y: 398, labelSide: "left" },
  { category: "linking", x: 34, y: 516, labelSide: "right" },
  { category: "fluent_reading", x: 63, y: 632, labelSide: "left" },
];

function isStableForNextStage(category: ExerciseCategory, learner: ReturnType<typeof loadLearnerState>) {
  const skill = learner.skills[category];
  return skill.level !== "discovery" && skill.stableAcrossContexts && skill.delayedCheckPassed;
}

export function PathPage({ onBack, onStart }: { onBack: () => void; onStart: (category: ExerciseCategory) => void }) {
  const learner = loadLearnerState();
  let currentIndex = 0;
  for (let index = 0; index < CATEGORY_ORDER.length - 1; index += 1) {
    if (isStableForNextStage(CATEGORY_ORDER[index], learner)) currentIndex = index + 1;
    else break;
  }
  const currentCategory = CATEGORY_ORDER[currentIndex];
  const currentSkill = learner.skills[currentCategory];
  const currentAccuracy = accuracyPercent(learner, currentCategory);

  return <main className="page path-page"><header className="path-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Retour à l’accueil"><ChevronLeft size={21} strokeWidth={1.8} /></button><span className="section-kicker">Ton parcours</span><h1>Construis une lecture sûre</h1><p>Chaque étape demande une précision stable avant la suivante.</p></header><section className="path-mastery-card" aria-label="État de maîtrise"><div className="path-mastery-card__level"><span>{LEVEL_SYMBOLS[currentSkill.level]}</span><div><small>Niveau actuel</small><strong>{LEVEL_LABELS[currentSkill.level]}</strong></div></div><div className="path-mastery-card__metric"><small>Précision observée</small><strong>{currentSkill.totalAttempts > 0 ? `${currentAccuracy} %` : "À établir"}</strong></div></section><section className="path-status" aria-label="Statut du parcours"><div className="level-chip"><ShieldCheck size={14} />Précision avant vitesse</div><div className="path-priority"><Target size={16} strokeWidth={1.8} /><span>{CATEGORY_LABELS[currentCategory]}</span></div></section><section className="learning-journey" aria-label="Chemin d’apprentissage"><svg className="journey-line" viewBox="0 0 360 720" preserveAspectRatio="none" aria-hidden="true"><path className="journey-line__base" d="M112 58 C252 100 280 132 241 168 C180 224 94 228 133 282 C184 352 282 330 248 398 C205 484 82 452 122 516 C171 595 255 580 227 632" /></svg>{stages.map((stage, index) => { const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "locked"; return <PathNode key={stage.category} index={index + 1} title={CATEGORY_LABELS[stage.category]} state={state} x={stage.x} y={stage.y} labelSide={stage.labelSide} onActivate={state !== "locked" ? () => onStart(stage.category) : undefined} />; })}</section></main>;
}
