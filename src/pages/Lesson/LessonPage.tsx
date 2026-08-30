import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Mic, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import {
  CATEGORY_RESOURCES,
  CloudflareVoiceAssessmentProvider,
  ControlledContentRepository,
  LessonSessionEngine,
  ReadingTimer,
  assessVoiceSafely,
  clearSessionCursor,
  loadCompletedSessionIds,
  loadLearnerState,
  loadSessionCursor,
  markSessionCompleted,
  nextSessionId,
  saveLearnerState,
  saveSessionCursor,
  type ControlledBatch,
  type ExerciseBlueprint,
  type ExerciseCategory,
  type LearnerState,
  type ResolvedInteraction,
  type VoiceAssessmentGuidance,
} from "../../learning";
import { CATEGORY_ORDER } from "../../learning/categoryCatalog";
import { isCategoryUnlocked } from "../../learning/mastery";
import { CATEGORY_LABELS, LEVEL_LABELS, LEVEL_SYMBOLS } from "../../learning/progressInsights";

type Phase = "ready" | "reading" | "assessing" | "self-check" | "retry" | "complete";
const METHOD_STEPS = ["Voir", "Décomposer", "Prononcer", "Fluidifier"] as const;
const instructions: Record<string, { kicker: (typeof METHOD_STEPS)[number]; title: string; hint: string }> = {
  guided_scan: { kicker: "Voir", title: "Observe chaque unité avant de lire.", hint: "Ne devine pas la forme globale. Suis exactement ce qui est écrit." },
  exact_read: { kicker: "Prononcer", title: "Lis exactement ce qui est affiché.", hint: "Garde chaque voyelle et chaque signe." },
  unit_tracking: { kicker: "Décomposer", title: "Suis les unités dans l’ordre, puis lis.", hint: "Aucune unité ne doit disparaître pendant la lecture." },
  oral_read: { kicker: "Prononcer", title: "Lis à voix haute, sans accélérer.", hint: "Une lecture lente et exacte vaut mieux qu’une lecture rapide et imprécise." },
  delayed_recall: { kicker: "Voir", title: "Relis sans t’appuyer sur la mémoire.", hint: "Regarde à nouveau les signes : lis ce qui est là, pas ce que tu attends." },
  mixed_exact_read: { kicker: "Fluidifier", title: "Garde la même précision dans ce nouveau contexte.", hint: "La fluidité n’est utile que si chaque signe reste exact." },
};

const voiceProvider = new CloudflareVoiceAssessmentProvider();

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Impossible de charger ${url}`);
  return response.json() as Promise<T>;
}

export function LessonPage({ category = "reading_units", onClose, onComplete }: { category?: ExerciseCategory; onClose: () => void; onComplete: () => void }) {
  const [sessionId, setSessionId] = useState("");
  const [sessionNumber, setSessionNumber] = useState(1);
  const [resolved, setResolved] = useState<ResolvedInteraction[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [learner, setLearner] = useState<LearnerState>(() => loadLearnerState());
  const [error, setError] = useState<string | null>(null);
  const [sessionReadingMs, setSessionReadingMs] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionRetries, setSessionRetries] = useState(0);
  const [micStatus, setMicStatus] = useState<"idle" | "recording" | "unavailable">("idle");
  const [voiceGuidance, setVoiceGuidance] = useState<VoiceAssessmentGuidance | null>(null);

  const timerRef = useRef<ReadingTimer | null>(null);
  const pendingTimingRef = useRef<ReturnType<ReadingTimer["finish"]> | null>(null);
  const engineRef = useRef<LessonSessionEngine | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceAssessmentGenerationRef = useRef(0);
  const finishInFlightRef = useRef(false);

  function invalidateVoiceAssessment() {
    voiceAssessmentGenerationRef.current += 1;
  }

  function stopCaptureTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setMicStatus("idle");
  }

  async function finalizeCapture(): Promise<Blob | null> {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      stopCaptureTracks();
      return null;
    }
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = audioChunksRef.current.length
          ? new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" })
          : null;
        stopCaptureTracks();
        resolve(blob);
      };
      recorder.stop();
    });
  }

  useEffect(() => () => {
    invalidateVoiceAssessment();
    stopCaptureTracks();
  }, []);

  useEffect(() => {
    let cancelled = false;
    invalidateVoiceAssessment();
    stopCaptureTracks();
    const resources = CATEGORY_RESOURCES[category];
    setError(null);
    setResolved([]);
    setIndex(0);
    setPhase("ready");
    setSessionReadingMs(0);
    setSessionCorrect(0);
    setSessionRetries(0);
    setVoiceGuidance(null);
    Promise.all([loadJson<ControlledBatch>(resources.manifestUrl), loadJson<ExerciseBlueprint>(resources.blueprintUrl)])
      .then(([batch, blueprint]) => {
        if (cancelled) return;
        if (blueprint.category !== category) throw new Error("Le parcours demandé ne correspond pas au contenu contrôlé chargé.");
        const repository = new ControlledContentRepository([batch]);
        repository.validateBlueprint(blueprint);
        const engine = new LessonSessionEngine(repository, blueprint);
        engineRef.current = engine;
        const selectedId = nextSessionId(blueprint, loadCompletedSessionIds());
        if (!selectedId) throw new Error("Aucune séance contrôlée disponible.");
        const selectedIndex = blueprint.sessions.findIndex((session) => session.id === selectedId);
        const session = engine.getSession(selectedId);
        const savedIndex = loadSessionCursor(selectedId);
        setSessionId(selectedId);
        setSessionNumber(selectedIndex + 1);
        setResolved(session);
        setIndex(savedIndex >= session.length ? 0 : savedIndex);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
      invalidateVoiceAssessment();
    };
  }, [category]);

  const current = resolved[index];
  const instruction = useMemo(() => current ? instructions[current.interaction.mode] ?? instructions.exact_read : instructions.exact_read, [current]);
  const progress = resolved.length ? ((index + 1) / resolved.length) * 100 : 0;
  const categoryIndex = CATEGORY_ORDER.indexOf(category);
  const nextCategory = CATEGORY_ORDER[categoryIndex + 1];
  const nextUnlocked = nextCategory ? isCategoryUnlocked(nextCategory, learner) : false;
  const skill = learner.skills[category];

  async function beginReading() {
    invalidateVoiceAssessment();
    finishInFlightRef.current = false;
    const timer = new ReadingTimer();
    timer.start();
    timer.markVoiceStart();
    timerRef.current = timer;
    pendingTimingRef.current = null;
    audioChunksRef.current = [];
    setVoiceGuidance(null);
    setPhase("reading");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicStatus("unavailable");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (timerRef.current !== timer) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.start();
      setMicStatus("recording");
    } catch {
      setMicStatus("unavailable");
    }
  }

  async function finishReading() {
    const timer = timerRef.current;
    if (!timer || !current || finishInFlightRef.current) return;
    const assessmentGeneration = voiceAssessmentGenerationRef.current;
    finishInFlightRef.current = true;
    try {
      timer.markVoiceEnd();
      pendingTimingRef.current = timer.finish();
      setPhase("assessing");
      const audio = await finalizeCapture();
      if (voiceAssessmentGenerationRef.current !== assessmentGeneration) return;
      if (!audio) {
        setVoiceGuidance({ status: "unavailable", message: "Aucun audio exploitable : le contrôle manuel reste nécessaire." });
        setPhase("self-check");
        return;
      }
      const guidance = await assessVoiceSafely(voiceProvider, {
        itemId: current.interaction.itemId,
        referenceText: current.arabicExact,
        audio,
        localeHint: "ar-SA",
      });
      if (voiceAssessmentGenerationRef.current !== assessmentGeneration) return;
      setVoiceGuidance(guidance);
      setPhase("self-check");
    } finally {
      if (voiceAssessmentGenerationRef.current === assessmentGeneration) finishInFlightRef.current = false;
    }
  }

  function recordAttempt(correct: boolean) {
    if (!current || !engineRef.current || !sessionId) return;
    invalidateVoiceAssessment();
    const timing = pendingTimingRef.current ?? undefined;
    const nextState = engineRef.current.record(learner, {
      itemId: current.interaction.itemId,
      sessionId,
      attemptedAt: new Date().toISOString(),
      outcome: correct ? "correct" : "incorrect",
      timing,
    });
    setLearner(nextState);
    saveLearnerState(nextState);
    if (!correct) {
      setSessionRetries((value) => value + 1);
      setPhase("retry");
      return;
    }
    if (timing) setSessionReadingMs((value) => value + timing.readingMs);
    setSessionCorrect((value) => value + 1);
    const nextIndex = index + 1;
    if (nextIndex >= resolved.length) {
      clearSessionCursor(sessionId);
      markSessionCompleted(sessionId);
      setPhase("complete");
      return;
    }
    saveSessionCursor(sessionId, nextIndex);
    setIndex(nextIndex);
    setPhase("ready");
  }

  function retry() {
    invalidateVoiceAssessment();
    pendingTimingRef.current = null;
    timerRef.current = null;
    setVoiceGuidance(null);
    setPhase("ready");
  }

  if (error) return <main className="lesson-page lesson-page--centered"><div className="lesson-error-card"><ShieldCheck size={24} /><h1>Session bloquée par sécurité</h1><p>{error}</p><p className="lesson-muted">Aucun contenu non vérifié ne sera affiché.</p><button className="secondary-cta" type="button" onClick={onClose}>Retour</button></div></main>;
  if (!current && phase !== "complete") return <main className="lesson-page lesson-page--centered" aria-busy="true"><div className="lesson-loader"><span className="lesson-loader__seal">ق</span><p>Préparation de la séance contrôlée…</p></div></main>;
  if (phase === "complete") return <main className="lesson-page lesson-complete"><div className="lesson-complete__seal"><Sparkles size={22} /></div><span className="section-kicker">Séance {sessionNumber} terminée</span><h1>{nextUnlocked ? "Une nouvelle étape s’ouvre." : "Une étape consolidée."}</h1><p>{nextUnlocked && nextCategory ? `${CATEGORY_LABELS[nextCategory]} est maintenant accessible.` : `${CATEGORY_LABELS[category]} reste au niveau ${LEVEL_SYMBOLS[skill.level]} ${LEVEL_LABELS[skill.level]}. Continue jusqu’à ce que la maîtrise soit stable.`}</p><div className="lesson-summary-grid"><div><span>Lectures exactes</span><strong>{sessionCorrect} / {resolved.length}</strong></div><div><span>Reprises</span><strong>{sessionRetries}</strong></div><div><span>Temps de lecture</span><strong>{Math.max(1, Math.round(sessionReadingMs / 1000))} s</strong></div></div><div className="lesson-principle"><ShieldCheck size={18} /><span>Le temps est observé. Il ne remplace jamais l’exactitude.</span></div><button className="primary-cta" type="button" onClick={onComplete}>{nextUnlocked ? "Voir la suite" : "Continuer"}</button></main>;

  return <main className="lesson-page"><header className="lesson-topbar"><button type="button" className="icon-button" onClick={onClose} aria-label="Quitter la séance"><ArrowLeft size={20} strokeWidth={1.8} /></button><div className="lesson-progress-copy"><span>Séance {sessionNumber}</span><strong>{index + 1} / {resolved.length}</strong></div></header><div className="lesson-progress-track" role="progressbar" aria-label="Progression de la séance" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div><section className="method-strip" aria-label="Méthode Itqān">{METHOD_STEPS.map((step) => <span key={step} className={step === instruction.kicker ? "method-strip__step is-current" : "method-strip__step"}>{step}</span>)}</section><section className="lesson-instruction"><span className="section-kicker">{instruction.kicker}</span><h1>{instruction.title}</h1><p>{instruction.hint}</p></section><section className="reading-stage" aria-live="polite"><div className="reading-stage__eyebrow"><span className="reading-stage__dot" />Source contrôlée</div><div className="reading-arabic" lang="ar" dir="rtl">{current.arabicExact}</div><div className="reading-stage__source"><ShieldCheck size={14} strokeWidth={1.8} /><span>Chaîne vérifiée deux fois sur le scan source.</span></div></section>{phase === "ready" && <section className="lesson-action"><button className="primary-cta" type="button" onClick={beginReading}><Mic size={18} strokeWidth={1.8} />Commencer ma lecture</button><p>Le chronomètre reste invisible. Si tu l’autorises, le micro est capturé pour une analyse contrôlée.</p></section>}{phase === "reading" && <section className="lesson-action lesson-action--reading"><div className="reading-live"><span className="reading-live__pulse" />Lis maintenant, à ton rythme. {micStatus === "recording" ? "Micro actif." : micStatus === "unavailable" ? "Micro indisponible : la séance continue sans audio." : ""}</div><button className="primary-cta" type="button" onClick={finishReading}>J’ai terminé</button></section>}{phase === "assessing" && <section className="self-check-card" aria-busy="true"><span className="section-kicker">Analyse contrôlée</span><h2>Vérification de l’enregistrement…</h2><p>Le résultat vocal reste informatif et ne décide pas seul de l’exactitude.</p></section>}{phase === "self-check" && <section className="self-check-card"><span className="section-kicker">Contrôle immédiat</span><h2>Ta lecture était-elle exacte ?</h2><p>{voiceGuidance?.message ?? "Le contrôle reste manuel tant que l’analyse vocale arabe n’a pas été validée avec le niveau d’exigence d’Itqān."}</p><div className="self-check-actions"><button className="self-check-button self-check-button--retry" type="button" onClick={() => recordAttempt(false)}><RotateCcw size={17} />À reprendre</button><button className="self-check-button self-check-button--correct" type="button" onClick={() => recordAttempt(true)}><Check size={18} />Exact</button></div></section>}{phase === "retry" && <section className="retry-card"><RotateCcw size={20} /><div><strong>Reprends la même lecture.</strong><p>Regarde à nouveau chaque signe avant de prononcer.</p></div><button className="secondary-cta" type="button" onClick={retry}>Relire</button></section>}</main>;
}
