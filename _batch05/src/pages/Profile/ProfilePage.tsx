import { Clock3, Flame, ShieldCheck, Sparkles } from "lucide-react";
import { loadLearnerState } from "../../learning/persistence";
import {
  LEVEL_LABELS,
  LEVEL_SYMBOLS,
  completedCorrectAttempts,
  computeStreakDays,
  totalReadingSeconds,
} from "../../learning/progressInsights";

export function ProfilePage() {
  const learner = loadLearnerState();
  const streak = computeStreakDays(learner.attempts);
  const correct = completedCorrectAttempts(learner);
  const seconds = totalReadingSeconds(learner);
  const units = learner.skills.reading_units;

  return (
    <main className="page profile-page">
      <header className="profile-header">
        <span className="section-kicker">Profil</span>
        <h1>Ta progression</h1>
        <p>
          La progression reflète une maîtrise observée, pas simplement des
          leçons ouvertes.
        </p>
      </header>

      <section className="profile-hero-card">
        <div className="profile-seal">
          <Sparkles size={19} />
        </div>
        <div>
          <span>Unités de lecture</span>
          <h2>
            {LEVEL_SYMBOLS[units.level]} {LEVEL_LABELS[units.level]}
          </h2>
          <p>
            {units.stableAcrossContexts
              ? "La précision tient maintenant dans plusieurs contextes."
              : "Continue jusqu’à ce que la précision reste stable dans plusieurs contextes."}
          </p>
        </div>
      </section>

      <section className="profile-metrics">
        <div>
          <Flame size={17} />
          <span>Régularité</span>
          <strong>{streak} j</strong>
        </div>
        <div>
          <ShieldCheck size={17} />
          <span>Lectures exactes</span>
          <strong>{correct}</strong>
        </div>
        <div>
          <Clock3 size={17} />
          <span>Lecture mesurée</span>
          <strong>{seconds} s</strong>
        </div>
      </section>

      <section className="profile-principle-card">
        <span className="section-kicker">Principe Itqān</span>
        <h2>La vitesse vient après la sûreté.</h2>
        <p>
          Le temps est suivi pour observer l’aisance. Une lecture plus rapide ne
          compense jamais une erreur.
        </p>
      </section>
    </main>
  );
}
