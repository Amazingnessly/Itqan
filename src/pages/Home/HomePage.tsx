import { ArrowRight, Flame, Map, RotateCcw, Sparkles } from "lucide-react";
import { Seal } from "../../components/ui/Seal";
import { loadLearnerState } from "../../learning/persistence";
import { CATEGORY_LABELS, computeStreakDays } from "../../learning/progressInsights";
import { buildReviewPlan } from "../../learning/reviewPlan";
import type { ExerciseCategory } from "../../learning/types";

export function HomePage({ onStart, onOpenPath }: { onStart: (category: ExerciseCategory) => void; onOpenPath: () => void }) {
  const learner = loadLearnerState();
  const streak = computeStreakDays(learner.attempts);
  const plan = buildReviewPlan(learner);
  const hasPractice = learner.attempts.length > 0;
  const missionCategory = hasPractice ? plan.category : "reading_units";
  const missionIsReview = hasPractice && (plan.dueNow || plan.errorCount > 0);

  return <main className="page home-page"><header className="home-header"><div className="brand-lockup"><Seal size="md" /><div className="brand-copy"><div className="brand-name">Itqān</div><div className="brand-tagline">Maîtrise chaque unité. Lis avec fluidité.</div></div></div><div className="streak-pill" aria-label={`Régularité : ${streak} jour${streak > 1 ? "s" : ""}`}><Flame size={16} strokeWidth={1.8} /><strong>{streak}</strong></div></header><section className="home-editorial" aria-labelledby="mission-title"><div className="home-visual-wrap"><img className="home-visual" src="/illustrations/family-reference-temp.jpeg" alt="Scène familiale chaleureuse à table" /><div className="home-visual-badge" aria-hidden="true"><Sparkles size={14} strokeWidth={1.7} /><span>Une étape à la fois</span></div></div><div className="mission-card"><span className="section-kicker">{missionIsReview ? "Révision prioritaire" : "Mission du jour"}</span><h1 id="mission-title">{missionIsReview ? "Stabilise avant d’avancer." : "La précision d’abord."}</h1><p>{missionIsReview ? plan.reason : "Une courte session pour consolider un seul geste de lecture avant d’accélérer."}</p><div className="mission-meta" aria-label="Objectif de la session"><span>{CATEGORY_LABELS[missionCategory]}</span><span>{missionIsReview ? "Reprise ciblée" : "Session contrôlée"}</span></div><button className="primary-cta" type="button" onClick={() => onStart(missionCategory)}>{missionIsReview && <RotateCcw size={17} strokeWidth={1.8} />}{missionIsReview ? "Lancer la reprise" : "Commencer la session"}<ArrowRight size={18} strokeWidth={1.8} /></button><button className="home-path-link" type="button" onClick={onOpenPath}><Map size={15} strokeWidth={1.7} />Voir mon parcours</button></div></section><section className="home-note" aria-label="Prochain cap"><span className="home-note__dot" aria-hidden="true" /><p><strong>Prochain cap</strong>{" "}{plan.dueNow ? "Vérifier maintenant que la lecture est restée stable après le délai." : plan.errorCount > 0 ? "Reprendre les lectures encore instables avant de poursuivre." : "Stabiliser la lecture avant d’augmenter le rythme."}</p></section></main>;
}
