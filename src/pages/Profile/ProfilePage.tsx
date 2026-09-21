import { Clock3, Flame, ShieldCheck, Sparkles } from "lucide-react";
import { hasPrecisionStability, learningStageSkill } from "../../learning/mastery";
import { loadLearnerState } from "../../learning/persistence";
import { LEVEL_LABELS, LEVEL_SYMBOLS, completedCorrectAttempts, computeStreakDays, learningStageProgress, totalReadingSeconds } from "../../learning/progressInsights";
import "./profilePath.css";

export function ProfilePage() {
  const learner = loadLearnerState();
  const streak = computeStreakDays(learner.attempts);
  const correct = completedCorrectAttempts(learner);
  const seconds = totalReadingSeconds(learner);
  const stages = learningStageProgress(learner);
  const unlocked = stages.filter((stage) => stage.unlocked);
  const currentStage = unlocked.at(-1) ?? stages[0];
  const currentSkill = learningStageSkill(learner, currentStage.id);
  const precisionStable = hasPrecisionStability(currentSkill);

  return <main className="page profile-page profile-page--refined"><header className="profile-header"><span className="section-kicker">Profil</span><h1>Ta progression</h1><p>La progression reflète une maîtrise observée, pas simplement des leçons ouvertes.</p></header><section className="profile-hero-card"><div className="profile-seal"><Sparkles size={19} /></div><div><span>{currentStage.label}</span><h2>{LEVEL_SYMBOLS[currentSkill.level]} {LEVEL_LABELS[currentSkill.level]}</h2><p>{precisionStable ? "La précision récente tient maintenant dans plusieurs contextes." : "Continue jusqu’à ce que l’exactitude récente reste stable dans plusieurs contextes."}</p></div></section><section className="profile-metrics"><div><Flame size={17} /><span>Régularité</span><strong>{streak} j</strong></div><div><ShieldCheck size={17} /><span>Lectures exactes</span><strong>{correct}</strong></div><div><Clock3 size={17} /><span>Lecture mesurée</span><strong>{seconds} s</strong></div></section><section className="profile-principle-card" aria-labelledby="profile-path-title"><span className="section-kicker">Parcours de maîtrise</span><h2 id="profile-path-title">{unlocked.length} étape{unlocked.length > 1 ? "s" : ""} accessible{unlocked.length > 1 ? "s" : ""} sur {stages.length}</h2><div className="profile-skill-list">{stages.map((stage) => <div className={`profile-skill-row${stage.unlocked ? "" : " profile-skill-row--locked"}`} key={stage.id}><div><strong>{stage.label}</strong><span>{stage.unlocked ? `${LEVEL_SYMBOLS[stage.level]} ${LEVEL_LABELS[stage.level]}` : "Verrouillée"}</span></div><span>{stage.unlocked && stage.totalAttempts > 0 ? `${stage.recentAccuracyPercent} % récent` : "—"}</span></div>)}</div></section><section className="profile-principle-card"><span className="section-kicker">Principe Itqān</span><h2>La vitesse vient après la sûreté.</h2><p>Le temps est suivi pour observer l’aisance. Une lecture plus rapide ne compense jamais une erreur.</p></section></main>;
}
