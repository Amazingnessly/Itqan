import { ArrowRight, Clock3, Flame, Map, RotateCcw, Sparkles } from "lucide-react";
import { Seal } from "../../components/ui/Seal";
import {
  LEARNING_STAGES,
  learningStageForSession,
  type LearningStageId,
} from "../../learning/categoryCatalog";
import {
  currentLearningStage,
  isLearningStageUnlocked,
  learningStageSkill,
  nextLearningStage,
} from "../../learning/mastery";
import { loadLearnerState } from "../../learning/persistence";
import { CATEGORY_LABELS, LEVEL_LABELS, computeStreakDays } from "../../learning/progressInsights";
import { buildReviewLaunchTarget, buildReviewPlan } from "../../learning/reviewPlan";
import { isLearningStageAvailableForActiveLesson } from "../../learning/sessionCatalog";
import type { ExerciseCategory } from "../../learning/types";

export function HomePage({
  onStart,
  onOpenPath,
}: {
  onStart: (category: ExerciseCategory, targetSessionId?: string, targetStageId?: LearningStageId) => void;
  onOpenPath: () => void;
}) {
  const learner = loadLearnerState();
  const streak = computeStreakDays(learner.attempts);
  const plan = buildReviewPlan(learner);
  const launchTarget = buildReviewLaunchTarget(learner, plan);
  const hasPractice = learner.attempts.length > 0;
  const currentStage = currentLearningStage(learner);
  const currentSkill = learningStageSkill(learner, currentStage.id);
  const pendingStage = LEARNING_STAGES.find(
    (stage) =>
      isLearningStageUnlocked(stage.id, learner)
      && !isLearningStageAvailableForActiveLesson(stage.id, learner)
  );
  const missionIsReview = hasPractice && launchTarget.kind === "urgent_review";
  const hasIncompleteSession = !missionIsReview && launchTarget.kind === "incomplete_session";
  const missionCategory = missionIsReview || hasIncompleteSession
    ? launchTarget.category
    : currentStage.category;
  const startSessionId = missionIsReview || hasIncompleteSession
    ? launchTarget.targetSessionId
    : undefined;
  const targetedStage = startSessionId
    ? learningStageForSession(missionCategory, startSessionId)
    : undefined;
  const missionStage = missionIsReview || hasIncompleteSession
    ? targetedStage
    : currentStage;
  const missionSkill = missionStage
    ? learningStageSkill(learner, missionStage.id)
    : learner.skills[missionCategory];
  const delayedReviewAt = currentSkill.nextReviewAt ? new Date(currentSkill.nextReviewAt) : null;
  const waitingForDelayedCheck = Boolean(
    !hasIncompleteSession
    && delayedReviewAt
    && delayedReviewAt.getTime() > Date.now()
    && !currentSkill.delayedCheckPassed
  );
  const nextStage = nextLearningStage(currentStage.id);

  const nextCap = missionIsReview
    ? plan.reason
    : hasIncompleteSession
      ? `Termine la séance en cours de ${missionStage?.label ?? CATEGORY_LABELS[missionCategory]} avant de passer au contrôle différé.`
      : waitingForDelayedCheck
        ? `La vérification différée sera disponible ${delayedReviewAt!.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`
        : pendingStage
          ? `${pendingStage.label} est déverrouillée dans ton parcours, mais aucune séance contrôlée n’est encore active.`
          : nextStage
            ? `Stabilise ${currentStage.label} au niveau Maîtrise pour ouvrir ${nextStage.label}.`
            : "Entretiens la fluidité acquise sans sacrifier l’exactitude.";

  return <main className="page home-page"><header className="home-header"><div className="brand-lockup"><Seal size="md" /><div className="brand-copy"><div className="brand-name">Itqān</div><div className="brand-tagline">Maîtrise chaque unité. Lis avec fluidité.</div></div></div><div className="streak-pill" aria-label={`Régularité : ${streak} jour${streak > 1 ? "s" : ""}`}><Flame size={16} strokeWidth={1.8} /><strong>{streak}</strong></div></header><section className="home-editorial" aria-labelledby="mission-title"><div className="home-visual-wrap"><img className="home-visual" src="/illustrations/family-reference-temp.jpeg" alt="Scène familiale chaleureuse à table" /><div className="home-visual-badge" aria-hidden="true"><Sparkles size={14} strokeWidth={1.7} /><span>Une étape à la fois</span></div></div><div className="mission-card"><span className="section-kicker">{missionIsReview ? "Révision prioritaire" : "Mission du jour"}</span><h1 id="mission-title">{missionIsReview ? "Stabilise avant d’avancer." : hasIncompleteSession ? "Reprends là où tu t’es arrêté." : waitingForDelayedCheck ? "Laisse la mémoire faire son travail." : "La précision d’abord."}</h1><p>{missionIsReview ? plan.reason : hasIncompleteSession ? "Une séance est déjà en cours. Termine-la avant de confondre reprise immédiate et vérification différée." : waitingForDelayedCheck ? "La prochaine vérification utile doit être espacée. Tu peux pratiquer sans confondre répétition immédiate et maîtrise durable." : "Travaille la compétence la plus avancée actuellement accessible."}</p><div className="mission-meta"><span>{missionStage?.label ?? CATEGORY_LABELS[missionCategory]}</span><span>{missionIsReview ? "Reprise ciblée" : hasIncompleteSession ? "Séance en cours" : LEVEL_LABELS[missionSkill.level]}</span></div><button className="primary-cta" type="button" onClick={() => onStart(missionCategory, startSessionId, missionStage?.id)}>{missionIsReview && <RotateCcw size={17} strokeWidth={1.8} />}{missionIsReview ? "Lancer la reprise" : hasIncompleteSession ? "Reprendre la session" : "Commencer la session"}<ArrowRight size={18} strokeWidth={1.8} /></button><button className="home-path-link" type="button" onClick={onOpenPath}><Map size={15} strokeWidth={1.7} />Voir mon parcours</button></div></section><section className="home-note" aria-label="Prochain cap">{waitingForDelayedCheck ? <Clock3 size={15} strokeWidth={1.8} /> : <span className="home-note__dot" aria-hidden="true" />}<p><strong>Prochain cap</strong>{" "}{nextCap}</p></section></main>;
}
