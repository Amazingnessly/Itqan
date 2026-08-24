import { Clock3, Flame, ShieldCheck, Sparkles } from "lucide-react";
import { CATEGORY_ORDER } from "../../learning/categoryCatalog";
import { isCategoryUnlocked } from "../../learning/mastery";
import { loadLearnerState } from "../../learning/persistence";
import {
  CATEGORY_LABELS,
  LEVEL_LABELS,
  LEVEL_SYMBOLS,
  accuracyPercent,
  completedCorrectAttempts,
  computeStreakDays,
  totalReadingSeconds,
} from "../../learning/progressInsights";

export function ProfilePage() {
  const learner = loadLearnerState();
  const streak = computeStreakDays(learner.attempts);
  const correct = completedCorrectAttempts(learner);
  const seconds = totalReadingSeconds(learner);
  const unlocked = CATEGORY_ORDER.filter((category) => isCategoryUnlocked(category, learner));
  const currentCategory = unlocked.at(-1) ?? "reading_units";
  const currentSkill = learner.skills[currentCategory];

  return (
    <main className="page profile-page profile-page--refined">
      <header className="profile-header">
        <span className="section-kicker">Profil</span>
        <h1>Ta progression</h1>
        <p>La progression reflète une maîtrise observée, pas simplement des leçons ouvertes.</p>
      </header>

      <section className="profile-hero-card">
        <div className="profile-seal"><Sparkles size={19} /></div>
        <div>
          <span>{CATEGORY_LABELS[currentCategory]}</span>
          <h2>{LEVEL_SYMBOLS[currentSkill.level]} {LEVEL_LABELS[currentSkill.level]}</h2>
          <p>{currentSkill.stableAcrossContexts ? "La précision tient maintenant dans plusieurs contextes." : "Continue jusqu’à ce que la précision reste stable dans plusieurs contextes."}</p>
        </div>
      </section>

      <section className="profile-metrics">
        <div><Flame size={17} /><span>Régularité</span><strong>{streak} j</strong></div>
        <div><ShieldCheck size={17} /><span>Lectures exactes</span><strong>{correct}</strong></div>
        <div><Clock3 size={17} /><span>Lecture mesurée</span><strong>{seconds} s</strong></div>
      </section>

      <section className="profile-principle-card" aria-labelledby="profile-path-title">
        <span className="section-kicker">Parcours de maîtrise</span>
        <h2 id="profile-path-title">{unlocked.length} étape{unlocked.length > 1 ? "s" : ""} accessible{unlocked.length > 1 ? "s" : ""} sur {CATEGORY_ORDER.length}</h2>
        <div className="profile-skill-list">
          {CATEGORY_ORDER.map((category) => {
            const skill = learner.skills[category];
            const canOpen = isCategoryUnlocked(category, learner);
            return <div className={`profile-skill-row${canOpen ? "" : " profile-skill-row--locked"}`} key={category}>
              <div><strong>{CATEGORY_LABELS[category]}</strong><span>{canOpen ? `${LEVEL_SYMBOLS[skill.level]} ${LEVEL_LABELS[skill.level]}` : "Verrouillée"}</span></div>
              <span>{canOpen && skill.totalAttempts > 0 ? `${accuracyPercent(learner, category)} %` : "—"}</span>
            </div>;
          })}
        </div>
      </section>

      <section className="profile-principle-card">
        <span className="section-kicker">Principe Itqān</span>
        <h2>La vitesse vient après la sûreté.</h2>
        <p>Le temps est suivi pour observer l’aisance. Une lecture plus rapide ne compense jamais une erreur.</p>
      </section>
    </main>
  );
}
