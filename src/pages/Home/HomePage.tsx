import { ArrowRight, Clock3, Flame, Map, RotateCcw, Sparkles } from "lucide-react";
import { Seal } from "../../components/ui/Seal";
import { CATEGORY_ORDER } from "../../learning/categoryCatalog";
import { isCategoryUnlocked } from "../../learning/mastery";
import { loadLearnerState } from "../../learning/persistence";
import { CATEGORY_LABELS, LEVEL_LABELS, computeStreakDays } from "../../learning/progressInsights";
import { buildReviewPlan } from "../../learning/reviewPlan";
import type { ExerciseCategory } from "../../learning/types";

export function HomePage({ onStart, onOpenPath }: { onStart: (category: ExerciseCategory) => void; onOpenPath: () => void }) {
  const learner = loadLearnerState();
  const streak = computeStreakDays(learner.attempts);
  const plan = buildReviewPlan(learner);
  const hasPractice = learner.attempts.length > 0;
  const unlocked = CATEGORY_ORDER.filter((category) => isCategoryUnlocked(category, learner));
  const currentCategory = unlocked.at(-1) ?? "reading_units";
  const currentSkill = learner.skills[currentCategory];
  const missionIsReview = hasPractice && (plan.dueNow || plan.errorCount > 0);
  const missionCategory = missionIsReview ? plan.category : currentCategory;
  const delayedReviewAt = currentSkill.nextReviewAt ? new Date(currentSkill.nextReviewAt) : null;
  const waitingForDelayedCheck = Boolean(delayedReviewAt && delayedReviewAt.getTime() > Date.now() && !currentSkill.delayedCheckPassed);
  const nextCategory = CATEGORY_ORDER[CATEGORY_ORDER.indexOf(currentCategory) + 1];

  const nextCap = missionIsReview
    ? plan.reason
    : waitingForDelayedCheck
      ? `La vérification différée sera disponible ${delayedReviewAt!.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`
      : nextCategory
        ? `Stabilise ${CATEGORY_LABELS[currentCategory]} au niveau Maîtrise pour ouvrir ${CATEGORY_LABELS[nextCategory]}.`
        : "Entretiens la fluidité acquise sans sacrifier l’exactitude.";

  return <main className="page home-page"><header className="home-header"><div className="brand-lockup"><Seal size="md" /><div className="brand-copy"><div className="brand-name">Itqān</div><div className="brand-tagline">Maîtrise chaque unité. Lis avec fluidité.</div></div></div><div className="streak-pill" aria-label={`Régularité : ${streak} jour${streak > 1 ? "s" : ""}`}><Flame size={16} strokeWidth={1.8} /><strong>{streak}</strong></div></header><section className="home-editorial" aria-labelledby="mission-title"><div className="home-visual-wrap"><img className="home-visual" src="/illustrations/family-reference-temp.jpeg" alt="Scène familiale chaleureuse à table" /><div className="home-visual-badge" aria-hidden="true"><Sparkles size={14} strokeWidth={1.7} /><span>Une étape à la fois</span></div></div><div className="mission-card"><span className="section-kicker">{missionIsReview ? "Révision prioritaire" : "Mission du jour"}</span><h1 id="mission-title">{missionIsReview ? "Stabilise avant d’avancer." : waitingForDelayedCheck ? "Laisse la mémoire faire son travail." : "La précision d’abord."}</h1><p>{missionIsReview ? plan.reason : waitingForDelayedCheck ? "La prochaine vérification utile doit être espacée. Tu peux pratiquer sans confondre répétition immédiate et maîtrise durable." : "Travaille la compétence la plus avancée actuellement accessible."}</p><div className="mission-meta" aria-label="Objectif de la session"><span>{CATEGORY_LABELS[missionCategory]}</span><span>{missionIsReview ? "Reprise ciblée" : LEVEL_LABELS[learner.skills[missionCategory].level]}</span></div><button className="primary-cta" type="button" onClick={() => onStart(missionCategory)}>{missionIsReview && <RotateCcw size={17} strokeWidth={1.8} />}{missionIsReview ? "Lancer la reprise" : "Commencer la session"}<ArrowRight size={18} strokeWidth={1.8} /></button><button className="home-path-link" type="button" onClick={onOpenPath}><Map size={15} strokeWidth={1.7} />Voir mon parcours</button></div></section><section className="home-note" aria-label="Prochain cap">{waitingForDelayedCheck ? <Clock3 size={15} strokeWidth={1.8} /> : <span className="home-note__dot" aria-hidden="true" />}<p><strong>Prochain cap</strong>{" "}{nextCap}</p></section></main>;
}
