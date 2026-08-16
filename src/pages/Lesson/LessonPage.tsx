import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  ControlledContentRepository,
  LessonSessionEngine,
  ReadingTimer,
  clearSessionCursor,
  loadLearnerState,
  loadSessionCursor,
  saveLearnerState,
  saveSessionCursor,
  type ControlledBatch,
  type ExerciseBlueprint,
  type LearnerState,
  type ResolvedInteraction,
} from "../../learning";

type Phase = "ready" | "reading" | "self-check" | "retry" | "complete";

const SESSION_ID = "UNITS-B01-S01";
const MANIFEST_URL = "/content/verified/s110-batch01.json";
const BLUEPRINT_URL = "/content/blueprints/units-batch01.json";

const METHOD_STEPS = ["Voir", "Décomposer", "Prononcer", "Fluidifier"] as const;

const instructions: Record<
  string,
  { kicker: (typeof METHOD_STEPS)[number]; title: string; hint: string }
> = {
  guided_scan: {
    kicker: "Voir",
    title: "Observe chaque unité avant de lire.",
    hint: "Ne devine pas la forme globale. Suis exactement ce qui est écrit.",
  },
  exact_read: {
    kicker: "Prononcer",
    title: "Lis exactement ce qui est affiché.",
    hint: "Garde chaque voyelle et chaque signe.",
  },
  unit_tracking: {
    kicker: "Décomposer",
    title: "Suis les unités dans l’ordre, puis lis.",
    hint: "Aucune unité ne doit disparaître pendant la lecture.",
  },
  oral_read: {
    kicker: "Prononcer",
    title: "Lis à voix haute, sans accélérer.",
    hint: "Une lecture lente et exacte vaut mieux qu’une lecture rapide et imprécise.",
  },
  delayed_recall: {
    kicker: "Voir",
    title: "Relis sans t’appuyer sur la mémoire.",
    hint: "Regarde à nouveau les signes : lis ce qui est là, pas ce que tu attends.",
  },
  mixed_exact_read: {
    kicker: "Fluidifier",
    title: "Garde la même précision dans ce nouveau contexte.",
    hint: "La fluidité n’est utile que si chaque signe reste exact.",
  },
};

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Impossible de charger ${url}`);
  return response.json() as Promise<T>;
}

export function LessonPage({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [resolved, setResolved] = useState<ResolvedInteraction[]>([]);
  const [index, setIndex] = useState(() => loadSessionCursor(SESSION_ID));
  const [phase, setPhase] = useState<Phase>("ready");
  const [learner, setLearner] = useState<LearnerState>(() => loadLearnerState());
  const [error, setError] = useState<string | null>(null);
  const [sessionReadingMs, setSessionReadingMs] = useState(0);
  const timerRef = useRef<ReadingTimer | null>(null);
  const pendingTimingRef = useRef<ReturnType<ReadingTimer["finish"]> | null>(null);
  const engineRef = useRef<LessonSessionEngine | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadJson<ControlledBatch>(MANIFEST_URL),
      loadJson<ExerciseBlueprint>(BLUEPRINT_URL),
    ])
      .then(([batch, blueprint]) => {
        if (cancelled) return;

        const repository = new ControlledContentRepository([batch]);
        const engine = new LessonSessionEngine(repository, blueprint);
        engineRef.current = engine;

        const session = engine.getSession(SESSION_ID);
        setResolved(session);

        if (index >= session.length) {
          clearSessionCursor(SESSION_ID);
          setIndex(0);
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "Chargement impossible.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const current = resolved[index];
  const instruction = useMemo(
    () =>
      current
        ? instructions[current.interaction.mode] ?? instructions.exact_read
        : instructions.exact_read,
    [current]
  );

  const progress = resolved.length ? ((index + 1) / resolved.length) * 100 : 0;

  function beginReading() {
    const timer = new ReadingTimer();
    timer.start();
    timer.markVoiceStart();
    timerRef.current = timer;
    pendingTimingRef.current = null;
    setPhase("reading");
  }

  function finishReading() {
    const timer = timerRef.current;
    if (!timer) return;

    timer.markVoiceEnd();
    pendingTimingRef.current = timer.finish();
    setPhase("self-check");
  }

  function recordAttempt(correct: boolean) {
    if (!current || !engineRef.current) return;

    const timing = pendingTimingRef.current ?? undefined;
    const nextState = engineRef.current.record(learner, {
      itemId: current.interaction.itemId,
      sessionId: SESSION_ID,
      attemptedAt: new Date().toISOString(),
      outcome: correct ? "correct" : "incorrect",
      timing,
    });

    setLearner(nextState);
    saveLearnerState(nextState);

    if (!correct) {
      setPhase("retry");
      return;
    }

    if (timing) {
      setSessionReadingMs((value) => value + timing.readingMs);
    }

    const nextIndex = index + 1;
    if (nextIndex >= resolved.length) {
      clearSessionCursor(SESSION_ID);
      setPhase("complete");
      return;
    }

    saveSessionCursor(SESSION_ID, nextIndex);
    setIndex(nextIndex);
    setPhase("ready");
  }

  function retry() {
    pendingTimingRef.current = null;
    timerRef.current = null;
    setPhase("ready");
  }

  if (error) {
    return (
      <main className="lesson-page lesson-page--centered">
        <div className="lesson-error-card">
          <ShieldCheck size={24} />
          <h1>Session bloquée par sécurité</h1>
          <p>{error}</p>
          <p className="lesson-muted">
            Aucun contenu non vérifié ne sera affiché.
          </p>
          <button className="secondary-cta" type="button" onClick={onClose}>
            Retour
          </button>
        </div>
      </main>
    );
  }

  if (!current && phase !== "complete") {
    return (
      <main className="lesson-page lesson-page--centered" aria-busy="true">
        <div className="lesson-loader">
          <span className="lesson-loader__seal">ق</span>
          <p>Préparation de la session contrôlée…</p>
        </div>
      </main>
    );
  }

  if (phase === "complete") {
    const correctAttempts = learner.attempts.filter(
      (attempt) =>
        attempt.sessionId === SESSION_ID && attempt.outcome === "correct"
    ).length;

    return (
      <main className="lesson-page lesson-complete">
        <div className="lesson-complete__seal">
          <Sparkles size={22} />
        </div>
        <span className="section-kicker">Session terminée</span>
        <h1>Précision consolidée.</h1>
        <p>
          Ces lectures reviendront dans d’autres contextes avant d’être
          considérées comme réellement maîtrisées.
        </p>

        <div className="lesson-summary-grid">
          <div>
            <span>Lectures validées</span>
            <strong>
              {Math.min(correctAttempts, resolved.length)}/{resolved.length}
            </strong>
          </div>
          <div>
            <span>Temps de lecture</span>
            <strong>{Math.max(1, Math.round(sessionReadingMs / 1000))} s</strong>
          </div>
        </div>

        <div className="lesson-principle">
          <ShieldCheck size={18} />
          <span>Le temps est observé. Il ne remplace jamais l’exactitude.</span>
        </div>

        <button className="primary-cta" type="button" onClick={onComplete}>
          Continuer
        </button>
      </main>
    );
  }

  return (
    <main className="lesson-page">
      <header className="lesson-topbar">
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Quitter la session"
        >
          <ArrowLeft size={20} strokeWidth={1.8} />
        </button>

        <div className="lesson-progress-copy">
          <span>Unités de lecture</span>
          <strong>
            {index + 1} / {resolved.length}
          </strong>
        </div>
      </header>

      <div
        className="lesson-progress-track"
        role="progressbar"
        aria-label="Progression de la session"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <span style={{ width: `${progress}%` }} />
      </div>

      <section className="method-strip" aria-label="Méthode Itqān">
        {METHOD_STEPS.map((step) => (
          <span
            key={step}
            className={
              step === instruction.kicker
                ? "method-strip__step is-current"
                : "method-strip__step"
            }
          >
            {step}
          </span>
        ))}
      </section>

      <section className="lesson-instruction">
        <span className="section-kicker">{instruction.kicker}</span>
        <h1>{instruction.title}</h1>
        <p>{instruction.hint}</p>
      </section>

      <section className="reading-stage" aria-live="polite">
        <div className="reading-stage__eyebrow">
          <span className="reading-stage__dot" />
          Source contrôlée
        </div>

        <div className="reading-arabic" lang="ar" dir="rtl">
          {current.arabicExact}
        </div>

        <div className="reading-stage__source">
          <ShieldCheck size={14} strokeWidth={1.8} />
          <span>Chaîne vérifiée deux fois sur le scan source.</span>
        </div>
      </section>

      {phase === "ready" && (
        <section className="lesson-action">
          <button className="primary-cta" type="button" onClick={beginReading}>
            <BookOpen size={18} strokeWidth={1.8} />
            Commencer ma lecture
          </button>
          <p>Le chronomètre reste invisible pendant la lecture.</p>
        </section>
      )}

      {phase === "reading" && (
        <section className="lesson-action lesson-action--reading">
          <div className="reading-live">
            <span className="reading-live__pulse" />
            Lis maintenant, à ton rythme.
          </div>
          <button className="primary-cta" type="button" onClick={finishReading}>
            J’ai terminé
          </button>
        </section>
      )}

      {phase === "self-check" && (
        <section className="self-check-card">
          <span className="section-kicker">Contrôle immédiat</span>
          <h2>Ta lecture était-elle exacte ?</h2>
          <p>
            Le contrôle reste manuel tant que la reconnaissance vocale arabe
            n’a pas été validée avec le niveau d’exigence d’Itqān.
          </p>
          <div className="self-check-actions">
            <button
              className="self-check-button self-check-button--retry"
              type="button"
              onClick={() => recordAttempt(false)}
            >
              <RotateCcw size={17} />
              À reprendre
            </button>
            <button
              className="self-check-button self-check-button--correct"
              type="button"
              onClick={() => recordAttempt(true)}
            >
              <Check size={18} />
              Exact
            </button>
          </div>
        </section>
      )}

      {phase === "retry" && (
        <section className="retry-card">
          <RotateCcw size={20} />
          <div>
            <strong>Reprends la même lecture.</strong>
            <p>Regarde à nouveau chaque signe avant de prononcer.</p>
          </div>
          <button className="secondary-cta" type="button" onClick={retry}>
            Relire
          </button>
        </section>
      )}
    </main>
  );
}
