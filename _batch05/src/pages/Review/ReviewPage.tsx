import {
  ArrowRight,
  CalendarClock,
  RotateCcw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { loadLearnerState } from "../../learning/persistence";
import {
  LEVEL_LABELS,
  LEVEL_SYMBOLS,
  accuracyPercent,
  recentErrors,
} from "../../learning/progressInsights";
import { buildReviewPlan } from "../../learning/reviewPlan";

export function ReviewPage({ onStart }: { onStart: () => void }) {
  const learner = loadLearnerState();
  const plan = buildReviewPlan(learner);
  const skill = learner.skills[plan.category];
  const accuracy = accuracyPercent(learner, plan.category);
  const errors = recentErrors(learner, plan.category);

  return (
    <main className="page review-page">
      <header className="review-header">
        <span className="section-kicker">Révision</span>
        <h1>Révision ciblée</h1>
        <p>
          Itqān reprend ce qui doit être stabilisé, pas une série choisie au
          hasard.
        </p>
      </header>

      <section className="review-priority-card">
        <div className="review-priority-card__topline">
          <span className="review-priority-icon">
            <Target size={18} strokeWidth={1.8} />
          </span>
          <span>Priorité actuelle</span>
        </div>

        <h2>{plan.title}</h2>
        <p>{plan.reason}</p>

        <div className="review-metrics">
          <div>
            <span>État</span>
            <strong>
              {LEVEL_SYMBOLS[skill.level]} {LEVEL_LABELS[skill.level]}
            </strong>
          </div>
          <div>
            <span>Précision</span>
            <strong>{skill.totalAttempts ? `${accuracy} %` : "À établir"}</strong>
          </div>
          <div>
            <span>Erreurs récentes</span>
            <strong>{errors}</strong>
          </div>
        </div>

        <button className="primary-cta" type="button" onClick={onStart}>
          <RotateCcw size={17} />
          Lancer la reprise
          <ArrowRight size={17} />
        </button>
      </section>

      <section className="review-method-card">
        <div>
          <ShieldCheck size={18} />
          <strong>Pourquoi cette reprise ?</strong>
        </div>
        <p>
          Une notion ne devient pas « maîtrisée » parce qu’une seule série a été
          réussie. Elle doit rester exacte dans plusieurs contextes et après un
          délai.
        </p>
      </section>

      <section className="review-next">
        <CalendarClock size={17} />
        <div>
          <strong>Révision différée</strong>
          <p>
            {skill.nextReviewAt
              ? "Le moteur a déjà planifié le prochain contrôle de stabilité."
              : "Le prochain contrôle sera programmé après les premières tentatives."}
          </p>
        </div>
      </section>
    </main>
  );
}
