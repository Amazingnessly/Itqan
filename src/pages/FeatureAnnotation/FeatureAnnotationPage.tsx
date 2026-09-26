import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileDown,
  FileUp,
  Image as ImageIcon,
  ShieldCheck,
} from "lucide-react";

type IntakeModule = {
  id: string;
  targetCategory: string;
  sourcePdfPages: number[];
  candidateBundle?: string;
  candidateCount?: number;
};

type IntakeRegistry = {
  schemaVersion: string;
  sourceDocument: {
    id: string;
    sha256: string;
    uploadedFilename: string;
  };
  modules: IntakeModule[];
};

type PromotedItem = {
  id: string;
  source: {
    sourceId: string;
    file: string;
    pdfPage: number;
    sourceOrder: number;
  };
  arabicExact: string;
  integrity: {
    utf8Sha256: string;
    normalizationApplied: false;
  };
  verification: {
    visualPass1: true;
    visualPass2: true;
    ambiguous: false;
    evidence: {
      full: string;
      crop: string;
    };
    evidenceIntegrity: {
      fullSha256: string;
      cropSha256: string;
    };
  };
  allowedExerciseTypes: string[];
  metadataStatus: string;
  eligibleForActiveLesson: false;
  active: false;
};

type PromotedCandidate = {
  schemaVersion: string;
  kind: "itqan-progressive-controlled-manifest-candidate";
  status: "human_verified_repository_evidence_bound_pending_item_metadata";
  sourceControl: {
    canonicalSourceId: string;
    canonicalFile: string;
    canonicalSha256: string;
    visualPassesPerItem: number;
    silentNormalization: false;
    modelOrOcrUsedAsAuthority: false;
  };
  verificationScope: {
    moduleId: string;
    targetCategory: string;
  };
  activationPolicy: {
    eligibleForActiveLesson: false;
    active: false;
    blockers: string[];
  };
  items: PromotedItem[];
};

type FocusMark = "fathah" | "kasrah" | "dammah" | "tanwin" | "sukun" | "shaddah";
type ArticleClass = "qamariyyah" | "shamsiyyah";
type MaterialShape = "isolated_word" | "two_words" | "multi_word";
type AnnotationDraft = {
  id: string;
  sourcePdfPage: number;
  sourceOrder: number;
  arabicUtf8Sha256: string;
  annotation: {
    focusMarksObserved: FocusMark[];
    articleClassObserved: ArticleClass[];
    materialShapeObserved: MaterialShape | "";
    hamzatWaslCandidate: boolean | null;
    featureInventoryComplete: boolean;
    targetFeatureConfirmed: boolean;
    stagePurityConfirmed: boolean;
    reviewedByQualifiedHuman: boolean;
    ambiguity: boolean | null;
    notes: string;
  };
};

type AnnotationArtifact = {
  schemaVersion: "0.1";
  kind: "itqan-progressive-item-feature-annotation";
  status: "pending_qualified_human_feature_annotation" | "qualified_human_feature_annotation_complete";
  sourceControl: {
    canonicalSourceId: string;
    canonicalSourceSha256: string;
    moduleId: string;
    targetCategory: string;
  };
  promotedCandidate: {
    sha256: string;
    itemCount: number;
  };
  annotationPolicy: {
    authority: "qualified_human";
    linguisticInferenceByAgent: false;
    featureInventoryMustBeComplete: true;
    targetFeatureMustBeHumanConfirmed: true;
    stagePurityMustBeHumanConfirmed: true;
  };
  items: AnnotationDraft[];
};

type CandidateState = {
  fileName: string;
  sha256: string;
  candidate: PromotedCandidate;
  module: IntakeModule;
};

const FOCUS_MARKS: FocusMark[] = ["fathah", "kasrah", "dammah", "tanwin", "sukun", "shaddah"];
const ARTICLE_CLASSES: ArticleClass[] = ["qamariyyah", "shamsiyyah"];
const MATERIAL_SHAPES: MaterialShape[] = ["isolated_word", "two_words", "multi_word"];

const FOCUS_LABELS: Record<FocusMark, string> = {
  fathah: "Fatḥah observée",
  kasrah: "Kasrah observée",
  dammah: "Ḍammah observée",
  tanwin: "Tanwīn observé",
  sukun: "Sukūn observé",
  shaddah: "Shaddah observée",
};

const ARTICLE_LABELS: Record<ArticleClass, string> = {
  qamariyyah: "Article qamariyyah",
  shamsiyyah: "Article shamsiyyah",
};

const MATERIAL_LABELS: Record<MaterialShape, string> = {
  isolated_word: "Mot isolé",
  two_words: "Deux mots",
  multi_word: "Plus de deux mots",
};

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(buffer: ArrayBuffer) {
  return toHex(await crypto.subtle.digest("SHA-256", buffer));
}

async function sha256TextExact(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function readJsonBytes<T>(file: File) {
  const buffer = await file.arrayBuffer();
  const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  return {
    buffer,
    value: JSON.parse(text) as T,
  };
}

function evidenceUrl(repositoryPath: string) {
  const normalized = repositoryPath.replaceAll("\\", "/");
  if (
    !normalized.startsWith("public/content/evidence/")
    || normalized.split("/").includes("..")
  ) {
    throw new Error("Chemin de preuve repository invalide.");
  }
  return normalized.slice("public".length);
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function emptyDraft(item: PromotedItem): AnnotationDraft {
  return {
    id: item.id,
    sourcePdfPage: item.source.pdfPage,
    sourceOrder: item.source.sourceOrder,
    arabicUtf8Sha256: item.integrity.utf8Sha256,
    annotation: {
      focusMarksObserved: [],
      articleClassObserved: [],
      materialShapeObserved: "",
      hamzatWaslCandidate: null,
      featureInventoryComplete: false,
      targetFeatureConfirmed: false,
      stagePurityConfirmed: false,
      reviewedByQualifiedHuman: false,
      ambiguity: null,
      notes: "",
    },
  };
}

function stagePolicyMessage(moduleId: string) {
  if (["fathah", "kasrah", "dammah", "madd_alif", "madd_ya", "madd_waw", "mixed_madd"].includes(moduleId)) {
    return "Mot isolé requis · aucun Sukūn, Shaddah ou article observé.";
  }
  if (moduleId === "tanwin_kasr" || moduleId === "tanwin_damm") {
    return "Mot isolé requis · Tanwīn observé · aucune Shaddah ni article.";
  }
  if (moduleId === "sukun") {
    return "Mot isolé requis · Sukūn observé · aucune Shaddah ni article.";
  }
  if (moduleId === "shaddah_source_block") {
    return "Mot isolé requis · Shaddah observée · aucun article.";
  }
  if (moduleId === "article_al_shamsiyyah_source") {
    return "Mot isolé requis · article shamsiyyah uniquement · Shaddah observée.";
  }
  if (moduleId === "two_words") {
    return "Forme « deux mots » requise.";
  }
  return "Aucune politique item-level contrôlée n’est définie pour ce module.";
}

function annotationFitsModule(moduleId: string, draft: AnnotationDraft) {
  const meta = draft.annotation;
  const focus = new Set(meta.focusMarksObserved);
  const article = meta.articleClassObserved;

  if (["fathah", "kasrah", "dammah", "madd_alif", "madd_ya", "madd_waw", "mixed_madd"].includes(moduleId)) {
    return meta.materialShapeObserved === "isolated_word"
      && !focus.has("sukun")
      && !focus.has("shaddah")
      && article.length === 0;
  }
  if (moduleId === "tanwin_kasr" || moduleId === "tanwin_damm") {
    return meta.materialShapeObserved === "isolated_word"
      && focus.has("tanwin")
      && !focus.has("shaddah")
      && article.length === 0;
  }
  if (moduleId === "sukun") {
    return meta.materialShapeObserved === "isolated_word"
      && focus.has("sukun")
      && !focus.has("shaddah")
      && article.length === 0;
  }
  if (moduleId === "shaddah_source_block") {
    return meta.materialShapeObserved === "isolated_word"
      && focus.has("shaddah")
      && article.length === 0;
  }
  if (moduleId === "article_al_shamsiyyah_source") {
    return meta.materialShapeObserved === "isolated_word"
      && focus.has("shaddah")
      && article.length === 1
      && article[0] === "shamsiyyah";
  }
  if (moduleId === "two_words") {
    return meta.materialShapeObserved === "two_words";
  }
  return false;
}

function annotationReady(moduleId: string, draft: AnnotationDraft) {
  const meta = draft.annotation;
  return Boolean(
    meta.materialShapeObserved
    && meta.hamzatWaslCandidate !== null
    && meta.featureInventoryComplete
    && meta.targetFeatureConfirmed
    && meta.stagePurityConfirmed
    && meta.reviewedByQualifiedHuman
    && meta.ambiguity === false
    && annotationFitsModule(moduleId, draft)
  );
}

export function FeatureAnnotationPage({ onBack }: { onBack: () => void }) {
  const [registry, setRegistry] = useState<IntakeRegistry | null>(null);
  const [candidateState, setCandidateState] = useState<CandidateState | null>(null);
  const [drafts, setDrafts] = useState<AnnotationDraft[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ensureRegistry() {
    if (registry) return registry;
    const response = await fetch("/content/source-intake/progressive-support.json");
    if (!response.ok) throw new Error("Registre progressif indisponible.");
    const value = await response.json() as IntakeRegistry;
    setRegistry(value);
    return value;
  }

  async function importCandidate(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const currentRegistry = await ensureRegistry();
      const { buffer, value: candidate } = await readJsonBytes<PromotedCandidate>(file);
      if (
        candidate.kind !== "itqan-progressive-controlled-manifest-candidate"
        || candidate.status !== "human_verified_repository_evidence_bound_pending_item_metadata"
      ) {
        throw new Error("Type de candidat promu inattendu.");
      }
      if (
        candidate.sourceControl?.canonicalSourceId !== currentRegistry.sourceDocument.id
        || candidate.sourceControl?.canonicalSha256 !== currentRegistry.sourceDocument.sha256
        || candidate.sourceControl?.canonicalFile !== currentRegistry.sourceDocument.uploadedFilename
        || candidate.sourceControl?.visualPassesPerItem !== 2
        || candidate.sourceControl?.silentNormalization !== false
        || candidate.sourceControl?.modelOrOcrUsedAsAuthority !== false
      ) {
        throw new Error("Le candidat promu ne correspond pas à la source canonique.");
      }
      if (
        candidate.activationPolicy?.eligibleForActiveLesson !== false
        || candidate.activationPolicy?.active !== false
        || !candidate.activationPolicy?.blockers?.includes("item_level_feature_metadata_required")
        || !candidate.activationPolicy?.blockers?.includes("controlled_manifest_review_required")
        || !candidate.activationPolicy?.blockers?.includes("session_policy_rebuild_required")
      ) {
        throw new Error("Le candidat ne conserve pas les bloqueurs d’activation obligatoires.");
      }

      const module = currentRegistry.modules.find((entry) => entry.id === candidate.verificationScope?.moduleId);
      if (!module?.candidateBundle || candidate.verificationScope?.targetCategory !== module.targetCategory) {
        throw new Error("Le module du candidat n’est pas enregistré pour cette source.");
      }

      const registeredResponse = await fetch(module.candidateBundle);
      if (!registeredResponse.ok) throw new Error("Bundle candidat enregistré indisponible.");
      const registeredBundle = await registeredResponse.json() as {
        kind: string;
        authoritative: boolean;
        sourceDocumentId: string;
        moduleId?: string;
        items: Array<{ moduleId: string; sourcePdfPage: number; sourceOrder: number }>;
      };
      if (
        registeredBundle.kind !== "itqan-progressive-provisional-transcription"
        || registeredBundle.authoritative !== false
        || registeredBundle.sourceDocumentId !== currentRegistry.sourceDocument.id
        || registeredBundle.moduleId !== module.id
      ) {
        throw new Error("Bundle candidat enregistré invalide.");
      }
      const registeredPositions = new Set(
        registeredBundle.items.map((item) => `${item.sourcePdfPage}:${item.sourceOrder}`),
      );

      if (!Array.isArray(candidate.items) || candidate.items.length === 0) {
        throw new Error("Le candidat promu est vide.");
      }

      const seenIds = new Set<string>();
      const seenPositions = new Set<string>();
      const evidenceHashCache = new Map<string, string>();
      async function repositoryEvidenceHash(repositoryPath: string) {
        const url = evidenceUrl(repositoryPath);
        const cached = evidenceHashCache.get(url);
        if (cached) return cached;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Preuve repository indisponible : ${repositoryPath}`);
        const hash = await sha256Bytes(await response.arrayBuffer());
        evidenceHashCache.set(url, hash);
        return hash;
      }

      for (const item of candidate.items) {
        const key = `${item.source?.pdfPage}:${item.source?.sourceOrder}`;
        if (
          !item.id
          || seenIds.has(item.id)
          || seenPositions.has(key)
          || item.source?.sourceId !== currentRegistry.sourceDocument.id
          || item.source?.file !== currentRegistry.sourceDocument.uploadedFilename
          || !module.sourcePdfPages.includes(item.source?.pdfPage)
          || !Number.isInteger(item.source?.sourceOrder)
          || item.source.sourceOrder <= 0
          || !registeredPositions.has(key)
        ) {
          throw new Error("Identité ou position source invalide dans le candidat promu.");
        }
        seenIds.add(item.id);
        seenPositions.add(key);

        if (
          !item.arabicExact
          || item.arabicExact !== item.arabicExact.trim()
          || item.integrity?.normalizationApplied !== false
          || await sha256TextExact(item.arabicExact) !== item.integrity?.utf8Sha256
        ) {
          throw new Error("Les octets exacts d’un item promu échouent au contrôle d’intégrité.");
        }
        if (
          item.verification?.visualPass1 !== true
          || item.verification?.visualPass2 !== true
          || item.verification?.ambiguous !== false
          || item.eligibleForActiveLesson !== false
          || item.active !== false
          || item.metadataStatus !== "pending_item_level_feature_annotation"
          || item.allowedExerciseTypes?.length !== 1
          || item.allowedExerciseTypes[0] !== module.targetCategory
        ) {
          throw new Error("Un item promu n’est pas dans l’état contrôlé attendu.");
        }

        const fullPath = item.verification?.evidence?.full;
        const cropPath = item.verification?.evidence?.crop;
        if (!fullPath || !cropPath || fullPath === cropPath) {
          throw new Error("Preuves full-page/crop manquantes ou confondues.");
        }
        const [fullHash, cropHash] = await Promise.all([
          repositoryEvidenceHash(fullPath),
          repositoryEvidenceHash(cropPath),
        ]);
        if (
          fullHash !== item.verification.evidenceIntegrity?.fullSha256
          || cropHash !== item.verification.evidenceIntegrity?.cropSha256
        ) {
          throw new Error("Le hash d’une preuve repository ne correspond plus aux octets déployés.");
        }
      }

      const sha256 = await sha256Bytes(buffer);
      setCandidateState({ fileName: file.name, sha256, candidate, module });
      setDrafts(candidate.items.map(emptyDraft));
      setCurrentIndex(0);
      setNotice(
        `${candidate.items.length} item${candidate.items.length > 1 ? "s" : ""} promu${candidate.items.length > 1 ? "s" : ""} chargé${candidate.items.length > 1 ? "s" : ""}. Les preuves et hashes repository ont été revalidés ; les métadonnées linguistiques restent à renseigner humainement.`,
      );
    } catch {
      setCandidateState(null);
      setDrafts([]);
      setCurrentIndex(0);
      setError("Le candidat promu est invalide, non déployé avec ses preuves, ou ne correspond plus au registre contrôlé.");
    } finally {
      setLoading(false);
    }
  }

  async function importAnnotation(file: File | undefined) {
    if (!file || !candidateState) return;
    setError(null);
    setNotice(null);
    try {
      const { value: artifact } = await readJsonBytes<AnnotationArtifact>(file);
      if (
        artifact.schemaVersion !== "0.1"
        || artifact.kind !== "itqan-progressive-item-feature-annotation"
        || !["pending_qualified_human_feature_annotation", "qualified_human_feature_annotation_complete"].includes(artifact.status)
        || artifact.sourceControl?.canonicalSourceId !== candidateState.candidate.sourceControl.canonicalSourceId
        || artifact.sourceControl?.canonicalSourceSha256 !== candidateState.candidate.sourceControl.canonicalSha256
        || artifact.sourceControl?.moduleId !== candidateState.module.id
        || artifact.sourceControl?.targetCategory !== candidateState.module.targetCategory
        || artifact.promotedCandidate?.sha256 !== candidateState.sha256
        || artifact.promotedCandidate?.itemCount !== candidateState.candidate.items.length
        || artifact.annotationPolicy?.authority !== "qualified_human"
        || artifact.annotationPolicy?.linguisticInferenceByAgent !== false
        || artifact.annotationPolicy?.featureInventoryMustBeComplete !== true
        || artifact.annotationPolicy?.targetFeatureMustBeHumanConfirmed !== true
        || artifact.annotationPolicy?.stagePurityMustBeHumanConfirmed !== true
      ) {
        throw new Error("Artifact d’annotation incompatible avec le candidat.");
      }
      if (!Array.isArray(artifact.items) || artifact.items.length !== candidateState.candidate.items.length) {
        throw new Error("Couverture d’annotation incomplète.");
      }

      const candidateById = new Map(candidateState.candidate.items.map((item) => [item.id, item]));
      const seen = new Set<string>();
      const nextDrafts = artifact.items.map((draft) => {
        const item = candidateById.get(draft.id);
        if (
          !item
          || seen.has(draft.id)
          || draft.sourcePdfPage !== item.source.pdfPage
          || draft.sourceOrder !== item.source.sourceOrder
          || draft.arabicUtf8Sha256 !== item.integrity.utf8Sha256
        ) {
          throw new Error("Référence d’annotation incohérente.");
        }
        seen.add(draft.id);

        const meta = draft.annotation;
        if (
          !Array.isArray(meta?.focusMarksObserved)
          || meta.focusMarksObserved.some((value) => !FOCUS_MARKS.includes(value))
          || new Set(meta.focusMarksObserved).size !== meta.focusMarksObserved.length
          || !Array.isArray(meta?.articleClassObserved)
          || meta.articleClassObserved.some((value) => !ARTICLE_CLASSES.includes(value))
          || new Set(meta.articleClassObserved).size !== meta.articleClassObserved.length
          || !["", ...MATERIAL_SHAPES].includes(meta?.materialShapeObserved)
          || !(meta?.hamzatWaslCandidate === null || typeof meta?.hamzatWaslCandidate === "boolean")
          || !(meta?.ambiguity === null || typeof meta?.ambiguity === "boolean")
          || typeof meta?.featureInventoryComplete !== "boolean"
          || typeof meta?.targetFeatureConfirmed !== "boolean"
          || typeof meta?.stagePurityConfirmed !== "boolean"
          || typeof meta?.reviewedByQualifiedHuman !== "boolean"
          || typeof meta?.notes !== "string"
        ) {
          throw new Error("Valeurs d’annotation non contrôlées.");
        }
        return draft;
      });

      setDrafts(nextDrafts);
      const firstIncomplete = nextDrafts.findIndex((draft) => !annotationReady(candidateState.module.id, draft));
      setCurrentIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
      setNotice(
        artifact.status === "qualified_human_feature_annotation_complete"
          ? "Annotation complète rechargée et liée au candidat exact."
          : "Brouillon d’annotation rechargé. Reprends au premier item encore incomplet.",
      );
    } catch {
      setError("Le fichier d’annotation ne correspond pas exactement au candidat promu chargé.");
    }
  }

  function updateCurrent(patch: Partial<AnnotationDraft["annotation"]>) {
    const item = drafts[currentIndex];
    if (!item) return;
    setDrafts((current) => current.map((draft, index) =>
      index === currentIndex
        ? { ...draft, annotation: { ...draft.annotation, ...patch } }
        : draft
    ));
  }

  const currentDraft = drafts[currentIndex];
  const currentItem = candidateState?.candidate.items.find((item) => item.id === currentDraft?.id);
  const completedCount = useMemo(
    () => candidateState
      ? drafts.filter((draft) => annotationReady(candidateState.module.id, draft)).length
      : 0,
    [candidateState, drafts],
  );
  const allComplete = Boolean(candidateState && drafts.length > 0 && completedCount === drafts.length);
  const currentFitsPolicy = Boolean(
    candidateState && currentDraft && annotationFitsModule(candidateState.module.id, currentDraft),
  );

  function buildArtifact(complete: boolean): AnnotationArtifact | null {
    if (!candidateState) return null;
    return {
      schemaVersion: "0.1",
      kind: "itqan-progressive-item-feature-annotation",
      status: complete
        ? "qualified_human_feature_annotation_complete"
        : "pending_qualified_human_feature_annotation",
      sourceControl: {
        canonicalSourceId: candidateState.candidate.sourceControl.canonicalSourceId,
        canonicalSourceSha256: candidateState.candidate.sourceControl.canonicalSha256,
        moduleId: candidateState.module.id,
        targetCategory: candidateState.module.targetCategory,
      },
      promotedCandidate: {
        sha256: candidateState.sha256,
        itemCount: candidateState.candidate.items.length,
      },
      annotationPolicy: {
        authority: "qualified_human",
        linguisticInferenceByAgent: false,
        featureInventoryMustBeComplete: true,
        targetFeatureMustBeHumanConfirmed: true,
        stagePurityMustBeHumanConfirmed: true,
      },
      items: drafts.map((draft) => ({
        ...draft,
        annotation: {
          ...draft.annotation,
          hamzatWaslCandidate: draft.annotation.hamzatWaslCandidate,
        },
      })),
    };
  }

  function downloadArtifact(complete: boolean) {
    const artifact = buildArtifact(complete);
    if (!artifact || (complete && !allComplete)) return;
    const serialized = JSON.stringify(artifact, null, 2) + "\n";
    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `itqan-${candidateState?.module.id}-feature-annotation-${complete ? "complete" : "draft"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page feature-annotation-page">
      <header className="subpage-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Retour aux sources">
          <ArrowLeft size={20} />
        </button>
        <div>
          <span className="section-kicker">Métadonnées contrôlées</span>
          <h1>Annoter les items promus</h1>
          <p>Charge un candidat déjà vérifié et lié à ses preuves. Aucun phénomène linguistique n’est prérempli : le réviseur qualifié reste l’autorité.</p>
        </div>
      </header>

      <section className="intake-safety-card" aria-label="Règle d’autorité">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>Annotation humaine uniquement</strong>
          <span>L’interface revalide les octets, positions et preuves repository. Elle ne déduit jamais les voyelles, marques, classe d’article ou forme du texte.</span>
        </div>
      </section>

      <section className="intake-card">
        <label className="intake-upload">
          <FileUp size={18} aria-hidden="true" />
          <span>{loading ? "Validation du candidat et des preuves…" : "Charger un candidat promu"}</span>
          <input
            type="file"
            accept="application/json,.json"
            disabled={loading}
            onChange={(event) => void importCandidate(event.target.files?.[0])}
          />
        </label>
        {candidateState && (
          <label className="intake-upload">
            <FileCheck2 size={18} aria-hidden="true" />
            <span>Reprendre depuis un brouillon d’annotation</span>
            <input type="file" accept="application/json,.json" onChange={(event) => void importAnnotation(event.target.files?.[0])} />
          </label>
        )}
        {candidateState && (
          <div className="intake-source-hint">
            <strong>{candidateState.module.id.replaceAll("_", " ")}</strong>
            <span>{candidateState.fileName} · {candidateState.candidate.items.length} item{candidateState.candidate.items.length > 1 ? "s" : ""}</span>
            <span>SHA candidat : {candidateState.sha256.slice(0, 16)}…</span>
            <span>{stagePolicyMessage(candidateState.module.id)}</span>
          </div>
        )}
        {notice && <p className="intake-notice">{notice}</p>}
        {error && <p className="intake-warning">{error}</p>}
      </section>

      {candidateState && currentDraft && currentItem && (
        <>
          <section className="annotation-progress-card">
            <div>
              <strong>Item {currentIndex + 1}/{drafts.length}</strong>
              <span>{completedCount}/{drafts.length} annotations complètes et conformes</span>
            </div>
            <div className="annotation-progress-track" aria-hidden="true">
              <span style={{ width: `${drafts.length ? (completedCount / drafts.length) * 100 : 0}%` }} />
            </div>
          </section>

          <article className="annotation-item-card">
            <div className="annotation-item-meta">
              <span>Page PDF {currentDraft.sourcePdfPage} · position {currentDraft.sourceOrder}</span>
              <strong>{currentDraft.id}</strong>
            </div>

            <div className="annotation-arabic" dir="rtl" lang="ar">{currentItem.arabicExact}</div>

            <div className="annotation-evidence-grid">
              <a href={evidenceUrl(currentItem.verification.evidence.full)} target="_blank" rel="noreferrer">
                <ImageIcon size={15} aria-hidden="true" />
                Page complète
              </a>
              <a href={evidenceUrl(currentItem.verification.evidence.crop)} target="_blank" rel="noreferrer">
                <ImageIcon size={15} aria-hidden="true" />
                Crop exact
              </a>
            </div>

            <div className="annotation-proof-preview">
              <figure>
                <img src={evidenceUrl(currentItem.verification.evidence.full)} alt={`Page source ${currentDraft.sourcePdfPage}`} />
                <figcaption>Page complète</figcaption>
              </figure>
              <figure>
                <img src={evidenceUrl(currentItem.verification.evidence.crop)} alt={`Crop source de l’item ${currentDraft.sourceOrder}`} />
                <figcaption>Crop exact</figcaption>
              </figure>
            </div>

            <section className="annotation-fieldset" aria-labelledby="focus-marks-title">
              <div>
                <strong id="focus-marks-title">Marques observées</strong>
                <span>Coche uniquement ce que tu constates visuellement.</span>
              </div>
              <div className="annotation-chip-grid">
                {FOCUS_MARKS.map((mark) => (
                  <label key={mark} className={currentDraft.annotation.focusMarksObserved.includes(mark) ? "annotation-chip is-selected" : "annotation-chip"}>
                    <input
                      type="checkbox"
                      checked={currentDraft.annotation.focusMarksObserved.includes(mark)}
                      onChange={() => updateCurrent({
                        focusMarksObserved: toggleValue(currentDraft.annotation.focusMarksObserved, mark),
                      })}
                    />
                    {FOCUS_LABELS[mark]}
                  </label>
                ))}
              </div>
            </section>

            <section className="annotation-fieldset" aria-labelledby="article-class-title">
              <div>
                <strong id="article-class-title">Classe d’article observée</strong>
                <span>Laisse vide si aucun article contrôlé n’est observé.</span>
              </div>
              <div className="annotation-chip-grid">
                {ARTICLE_CLASSES.map((articleClass) => (
                  <label key={articleClass} className={currentDraft.annotation.articleClassObserved.includes(articleClass) ? "annotation-chip is-selected" : "annotation-chip"}>
                    <input
                      type="checkbox"
                      checked={currentDraft.annotation.articleClassObserved.includes(articleClass)}
                      onChange={() => updateCurrent({
                        articleClassObserved: toggleValue(currentDraft.annotation.articleClassObserved, articleClass),
                      })}
                    />
                    {ARTICLE_LABELS[articleClass]}
                  </label>
                ))}
              </div>
            </section>

            <label className="intake-field">
              <span>Forme observée</span>
              <select
                value={currentDraft.annotation.materialShapeObserved}
                onChange={(event) => updateCurrent({ materialShapeObserved: event.target.value as MaterialShape | "" })}
              >
                <option value="">À renseigner</option>
                {MATERIAL_SHAPES.map((shape) => <option key={shape} value={shape}>{MATERIAL_LABELS[shape]}</option>)}
              </select>
            </label>

            <label className="intake-field">
              <span>Candidat Hamzat-Wasl ?</span>
              <select
                value={currentDraft.annotation.hamzatWaslCandidate === null ? "unreviewed" : currentDraft.annotation.hamzatWaslCandidate ? "yes" : "no"}
                onChange={(event) => updateCurrent({
                  hamzatWaslCandidate: event.target.value === "unreviewed" ? null : event.target.value === "yes",
                })}
              >
                <option value="unreviewed">À vérifier</option>
                <option value="no">Non</option>
                <option value="yes">Oui</option>
              </select>
            </label>

            <div className="annotation-confirmations">
              <label><input type="checkbox" checked={currentDraft.annotation.featureInventoryComplete} onChange={(event) => updateCurrent({ featureInventoryComplete: event.target.checked })} /> Inventaire contrôlé complet</label>
              <label><input type="checkbox" checked={currentDraft.annotation.targetFeatureConfirmed} onChange={(event) => updateCurrent({ targetFeatureConfirmed: event.target.checked })} /> Phénomène cible confirmé</label>
              <label><input type="checkbox" checked={currentDraft.annotation.stagePurityConfirmed} onChange={(event) => updateCurrent({ stagePurityConfirmed: event.target.checked })} /> Pureté de l’étape confirmée</label>
              <label><input type="checkbox" checked={currentDraft.annotation.reviewedByQualifiedHuman} onChange={(event) => updateCurrent({ reviewedByQualifiedHuman: event.target.checked })} /> Revu par un humain qualifié</label>
            </div>

            <label className="intake-field">
              <span>Métadonnées ambiguës ?</span>
              <select
                value={currentDraft.annotation.ambiguity === null ? "unreviewed" : currentDraft.annotation.ambiguity ? "yes" : "no"}
                onChange={(event) => updateCurrent({
                  ambiguity: event.target.value === "unreviewed" ? null : event.target.value === "yes",
                })}
              >
                <option value="unreviewed">À vérifier</option>
                <option value="no">Non</option>
                <option value="yes">Oui</option>
              </select>
            </label>

            <label className="intake-field">
              <span>Notes facultatives</span>
              <textarea
                rows={2}
                value={currentDraft.annotation.notes}
                onChange={(event) => updateCurrent({ notes: event.target.value })}
              />
            </label>

            <div className={annotationReady(candidateState.module.id, currentDraft) ? "annotation-item-status is-ready" : "annotation-item-status is-pending"}>
              {annotationReady(candidateState.module.id, currentDraft)
                ? <><CheckCircle2 size={16} aria-hidden="true" /><span>Item prêt pour le gate d’annotation.</span></>
                : <span>{currentFitsPolicy ? "Complète tous les contrôles explicites avant validation." : stagePolicyMessage(candidateState.module.id)}</span>}
            </div>
          </article>

          <nav className="annotation-pager" aria-label="Navigation entre les items">
            <button className="secondary-cta" type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}>
              <ChevronLeft size={16} /> Précédent
            </button>
            <button className="secondary-cta" type="button" disabled={currentIndex >= drafts.length - 1} onClick={() => setCurrentIndex((index) => Math.min(drafts.length - 1, index + 1))}>
              Suivant <ChevronRight size={16} />
            </button>
          </nav>

          <section className="intake-export-card annotation-export-card">
            <div>
              <strong>{completedCount}/{drafts.length} items prêts</strong>
              <span>Le brouillon peut être exporté à tout moment ; la version complète exige chaque contrôle.</span>
            </div>
            <button className="secondary-cta" type="button" onClick={() => downloadArtifact(false)}>
              <FileDown size={16} /> Exporter le brouillon
            </button>
            <button className="primary-cta" type="button" disabled={!allComplete} onClick={() => downloadArtifact(true)}>
              <FileCheck2 size={18} /> Valider et exporter
            </button>
          </section>
        </>
      )}
    </main>
  );
}
