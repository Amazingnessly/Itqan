import { ChevronLeft, ShieldCheck, Target } from "lucide-react";
import { PathNode } from "../../components/path/PathNode";
import { LEARNING_STAGES, type LearningStageId } from "../../learning/categoryCatalog";
import {
  currentLearningStage,
  isLearningStageMastered,
  isLearningStageUnlocked,
  isPathMastered,
  learningStageSkill,
} from "../../learning/mastery";
import { loadLearnerState } from "../../learning/persistence";
import { LEVEL_LABELS, LEVEL_SYMBOLS } from "../../learning/progressInsights";
import { isLearningStageAvailableForActiveLesson } from "../../learning/sessionCatalog";
import type { ExerciseCategory } from "../../learning/types";

const stageLayout: Record<LearningStageId, { x: number; y: number; labelSide: "left" | "right" }> = {
  reading_units: { x: 31, y: 58, labelSide: "right" },
  vowels_sukun: { x: 67, y: 162, labelSide: "left" },
  article_qamariyyah: { x: 37, y: 270, labelSide: "right" },
  shaddah: { x: 69, y: 380, labelSide: "left" },
  article_shamsiyyah: { x: 34, y: 492, labelSide: "right" },
  linking: { x: 66, y: 604, labelSide: "left" },
  fluent_reading: { x: 36, y: 716, labelSide: "right" },
};

export function PathPage({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (category: ExerciseCategory, stageId: LearningStageId) => void;
}) {
  const learner = loadLearnerState();
  const currentStage = currentLearningStage(learner);
  const currentSkill = learningStageSkill(learner, currentStage.id);
  const currentAccuracy = currentSkill.totalAttempts > 0
    ? Math.round(currentSkill.recentAccuracy * 100)
    : 0;
  const pathMastered = isPathMastered(learner);

  return <main className="page path-page"><header className="path-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Retour à l’accueil"><ChevronLeft size={21} strokeWidth={1.8} /></button><span className="section-kicker">Ton parcours</span><h1>Construis une lecture sûre</h1><p>Chaque étape demande une précision stable avant la suivante.</p></header><section className="path-mastery-card" aria-label="État de maîtrise"><div className="path-mastery-card__level"><span>{LEVEL_SYMBOLS[currentSkill.level]}</span><div><small>Niveau actuel</small><strong>{LEVEL_LABELS[currentSkill.level]}</strong></div></div><div className="path-mastery-card__metric"><small>Précision récente</small><strong>{currentSkill.totalAttempts > 0 ? `${currentAccuracy} %` : "À établir"}</strong></div></section><section className="path-status" aria-label="Statut du parcours"><div className="level-chip"><ShieldCheck size={14} />Précision avant vitesse</div><div className="path-priority"><Target size={16} strokeWidth={1.8} /><span>{pathMastered ? "Parcours maîtrisé" : currentStage.label}</span></div></section><section className="learning-journey" aria-label="Chemin d’apprentissage"><svg className="journey-line" viewBox="0 0 360 800" preserveAspectRatio="none" aria-hidden="true"><path className="journey-line__base" d="M112 58 C252 96 280 130 241 162 C180 216 94 224 133 270 C184 330 282 324 248 380 C205 452 82 438 122 492 C171 566 255 550 238 604 C216 668 118 660 130 716" /></svg>{LEARNING_STAGES.map((stage, index) => { const layout = stageLayout[stage.id]; const unlocked = isLearningStageUnlocked(stage.id, learner); const mastered = isLearningStageMastered(stage.id, learner); const canOpen = isLearningStageAvailableForActiveLesson(stage.id, learner); const state = !canOpen ? "locked" : mastered ? "done" : stage.id === currentStage.id ? "current" : "available"; return <PathNode key={stage.id} index={index + 1} title={stage.label} state={state} x={layout.x} y={layout.y} labelSide={layout.labelSide} lockedLabel={unlocked && !canOpen ? "Contenu en attente" : undefined} onActivate={canOpen ? () => onStart(stage.category, stage.id) : undefined} />; })}</section></main>;
}
