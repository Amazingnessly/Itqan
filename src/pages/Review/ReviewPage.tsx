import { ArrowRight, CalendarClock, RotateCcw, ShieldCheck, Target } from "lucide-react";
import { hasPrecisionStability } from "../../learning/mastery";
import { loadLearnerState } from "../../learning/persistence";
import { CATEGORY_LABELS, LEVEL_LABELS, LEVEL_SYMBOLS, recentAccuracyPercent, recentErrors } from "../../learning/progressInsights";
import { buildReviewLaunchTarget, buildReviewPlan } from "../../learning/reviewPlan";
import type { ExerciseCategory } from "../../learning/types";

function reviewTimingLabel(nextReviewAt?: string) {
  if (!nextReviewAt) return null;
  const due = new Date(nextReviewAt);
  const deltaMs = due.getTime() - Date.now();
  if (deltaMs <= 0) return "À faire maintenant";
  const hours = Math.ceil(deltaMs / (60 * 60 * 1000));
  if (hours < 24) return `Dans environ ${hours} h`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(due);
}

export function ReviewPage({ onStart }: { onStart: (category: ExerciseCategory, targetSessionId?: string) => void }) {
  const learner = loadLearnerState();
  const plan = buildReviewPlan(learner);
  const launchTarget = buildReviewLaunchTarget(learner, plan);
  const category = launchTarget.category;
  const skill = learner.skills[category];
  const accuracy = recentAccuracyPercent(learner, category);
  const errors = recentErrors(learner, category);
  const timingLabel = reviewTimingLabel(skill.nextReviewAt);
  const urgentReview = launchTarget.kind === "urgent_review";
  const resumeIncomplete = launchTarget.kind === "incomplete_session";
  const needsPrecisionStability = !urgentReview && !resumeIncomplete && !hasPrecisionStability(skill);
  const dueNow = Boolean(skill.nextReviewAt && Date.parse(skill.nextReviewAt) <= Date.now());
  const actionLabel = urgentReview
    ? "Lancer la reprise"
    : resumeIncomplete
      ? "Reprendre la session"
      : needsPrecisionStability
        ? "Stabiliser ma lecture"
        : "Faire une reprise d’entretien";
  const priorityLabel = urgentReview
    ? "Priorité actuelle"
    : resumeIncomplete
      ? "Séance en cours"
      : needsPrecisionStability
        ? "Stabilité à construire"
        : "Entretien conseillé";
  const heading = urgentReview
    ? "Révision ciblée"
    : resumeIncomplete
      ? "Reprendre la séance"
      : needsPrecisionStability
        ? "Stabiliser la précision"
        : "Entretenir la maîtrise";
  const introduction = urgentReview
    ? "Itqān reprend ce qui doit être stabilisé, pas une série choisie au hasard."
    : resumeIncomplete
      ? "Une séance contrôlée est déjà commencée. Termine-la avant d’ouvrir une autre reprise non urgente."
      : needsPrecisionStability
        ? "Renforce l’exactitude dans plusieurs contextes contrôlés jusqu’à ce que la précision récente soit stable."
        : "Aucune reprise urgente : tu peux entretenir une compétence déjà accessible sans contourner ton parcours.";
  const cardTitle = resumeIncomplete ? CATEGORY_LABELS[category] : plan.title;
  const cardReason = resumeIncomplete
    ? "Reprends exactement au prochain item canonique de cette séance."
    : plan.reason;

  return <main className="page review-page review-page--refined"><header className="review-header"><span className="section-kicker">Révision</span><h1>{heading}</h1><p>{introduction}</p></header><section className="review-priority-card"><div className="review-priority-card__topline"><span className="review-priority-icon"><Target size={18} strokeWidth={1.8} /></span><span>{priorityLabel}</span></div><h2>{cardTitle}</h2><p>{cardReason}</p><div className="review-metrics"><div><span>État</span><strong>{LEVEL_SYMBOLS[skill.level]} {LEVEL_LABELS[skill.level]}</strong></div><div><span>Précision récente</span><strong>{skill.totalAttempts ? `${accuracy} %` : "À établir"}</strong></div><div><span>Erreurs récentes</span><strong>{errors}</strong></div></div><button className="primary-cta" type="button" onClick={() => onStart(category, launchTarget.targetSessionId)}>{urgentReview || resumeIncomplete ? <RotateCcw size={17} /> : <ShieldCheck size={17} />}{actionLabel}<ArrowRight size={17} /></button></section><section className="review-method-card"><div><ShieldCheck size={18} /><strong>Pourquoi cette reprise ?</strong></div><p>Une notion ne devient pas « maîtrisée » parce qu’une seule série a été réussie. Elle doit rester exacte dans plusieurs contextes et après un délai.</p></section><section className={`review-next${dueNow ? " review-next--due" : ""}`}><CalendarClock size={17} /><div><strong>{dueNow && skill.nextReviewAt ? "Contrôle de stabilité disponible" : skill.nextReviewAt ? "Révision différée programmée" : "Stabilité différée"}</strong><p>{timingLabel ?? (skill.delayedCheckPassed ? "Le contrôle différé a été validé." : "Le prochain contrôle sera programmé après une première réussite.")}</p></div></section></main>;
}
