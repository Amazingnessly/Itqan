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
};

type IntakeRegistry = {
  sourceDocument: {
    id: string;
    sha256: string;
    uploadedFilename: string;
  };
  modules: IntakeModule[];
};

type FeatureAnnotationPolicy = {
  schemaVersion: "0.1";
  kind: "itqan-progressive-feature-annotation-policy";
  modules: Array<{
    id: string;
    targetCategory: string;
    materialShape: string;
    requiredMarks: string[];
    forbiddenMarks: string[];
    articleClasses: "none" | "any" | "shamsiyyah_only";
    guidanceFr: string;
  }>;
};

type Evidence = {
  full: string;
  crop: string;
};

type EvidenceIntegrity = {
  fullSha256: string;
  cropSha256: string;
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
    evidence: Evidence;
    evidenceIntegrity: EvidenceIntegrity;
  };
  allowedExerciseTypes: string[];
  metadataStatus: string;
  eligibleForActiveLesson: false;
  active: false;
};

type PromotedCandidate = {
  schemaVersion: "0.1";
  kind: "itqan-progressive-controlled-manifest-candidate";
  status: "human_verified_repository_evidence_bound_pending_item_metadata";
  sourceControl: {
    canonicalSourceId: string;
    canonicalFile: string;
    canonicalSha256: string;
    visualPassesPerItem: 2;
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

type FeatureAnnotationItem = {
  id: string;
  sourcePdfPage: number;
  sourceOrder: number;
  arabicUtf8Sha256: string;
  annotation: {
    focusMarksObserved: string[];
    articleClassObserved: string[];
    materialShapeObserved: string;
    hamzatWaslCandidate: boolean;
    featureInventoryComplete: true;
    targetFeatureConfirmed: true;
    stagePurityConfirmed: true;
    reviewedByQualifiedHuman: true;
    ambiguous: false;
    notes: string;
  };
};

type FeatureAnnotation = {
  schemaVersion: "0.1";
  kind: "itqan-progressive-item-feature-annotation";
  status: "qualified_human_feature_annotation_complete";
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
  featureAnnotationPolicy: {
    schemaVersion: "0.1";
    sha256: string;
  };
  annotationPolicy: {
    authority: "qualified_human";
    linguisticInferenceByAgent: false;
    featureInventoryMustBeComplete: true;
    targetFeatureMustBeHumanConfirmed: true;
    stagePurityMustBeHumanConfirmed: true;
  };
  items: FeatureAnnotationItem[];
};

type AnnotatedItem = PromotedItem & {
  focusMarksObserved: string[];
  articleClassObserved: string[];
  materialShapeObserved: string;
  hamzatWaslCandidate: boolean;
  targetFeatureConfirmed: true;
  stagePurityConfirmed: true;
  metadataStatus: "human_annotated_pending_controlled_manifest_review";
};

type AnnotatedCandidate = Omit<PromotedCandidate, "status" | "activationPolicy" | "items"> & {
  status: "human_verified_repository_evidence_bound_item_metadata_annotated_pending_controlled_manifest_review";
  annotationControl: {
    schemaVersion: "0.1";
    kind: "itqan-progressive-item-feature-annotation";
    authority: "qualified_human";
    linguisticInferenceByAgent: false;
    promotedCandidateSha256: string;
    featureAnnotationPolicySchemaVersion: "0.1";
    featureAnnotationPolicySha256: string;
    featureInventoryComplete: true;
  };
  activationPolicy: {
    eligibleForActiveLesson: false;
    active: false;
    blockers: string[];
  };
  items: AnnotatedItem[];
};

type ReviewDecision = {
  exactBytesAndHashReviewed: boolean;
  evidenceBindingReviewed: boolean;
  featureMetadataReviewed: boolean;
  exerciseAuthorizationReviewed: boolean;
  stagePurityReviewed: boolean;
  decision: "approve" | "reject" | null;
  reviewedByQualifiedContentReviewer: boolean;
  notes: string;
};

type ReviewDraftItem = {
  id: string;
  sourcePdfPage: number;
  sourceOrder: number;
  arabicUtf8Sha256: string;
  controlledMetadataSha256: string;
  review: ReviewDecision;
};

type ReviewArtifact = {
  schemaVersion: "0.1";
  kind: "itqan-progressive-controlled-manifest-review";
  status: "pending_qualified_content_review" | "qualified_content_review_complete";
  sourceControl: {
    canonicalSourceId: string;
    canonicalSourceSha256: string;
    moduleId: string;
    targetCategory: string;
  };
  inputs: {
    promotedCandidateSha256: string;
    featureAnnotationSha256: string;
    annotatedCandidateSha256: string;
    featureAnnotationPolicySha256: string;
    itemCount: number;
  };
  reviewPolicy: {
    authority: "qualified_content_reviewer";
    contentRewriteAllowed: false;
    activationAllowed: false;
    itemExclusionAllowed: false;
    everyItemDecisionRequired: true;
  };
  items: ReviewDraftItem[];
};

type LoadedPacket = {
  promoted: PromotedCandidate;
  annotation: FeatureAnnotation;
  annotated: AnnotatedCandidate;
  promotedSha256: string;
  annotationSha256: string;
  annotatedSha256: string;
  module: IntakeModule;
  modulePolicy: FeatureAnnotationPolicy["modules"][number];
  featurePolicySha256: string;
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

async function readJsonBytes(file: File) {
  const buffer = await file.arrayBuffer();
  const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  return {
    file,
    buffer,
    sha256: await sha256Bytes(buffer),
    value: JSON.parse(text) as unknown,
  };
}

function evidenceUrl(repositoryPath: string) {
  const normalized = repositoryPath.replaceAll("\\", "/");
  if (!normalized.startsWith("public/content/evidence/") || normalized.split("/").includes("..")) {
    throw new Error("Chemin de preuve repository invalide.");
  }
  return normalized.slice("public".length);
}

function controlledMetadataSnapshot(item: AnnotatedItem) {
  return {
    allowedExerciseTypes: item.allowedExerciseTypes,
    focusMarksObserved: item.focusMarksObserved,
    articleClassObserved: item.articleClassObserved,
    materialShapeObserved: item.materialShapeObserved,
    hamzatWaslCandidate: item.hamzatWaslCandidate,
    targetFeatureConfirmed: item.targetFeatureConfirmed,
    stagePurityConfirmed: item.stagePurityConfirmed,
    metadataStatus: item.metadataStatus,
  };
}

async function controlledMetadataSha256(item: AnnotatedItem) {
  return sha256TextExact(JSON.stringify(controlledMetadataSnapshot(item)));
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function annotationMatchesPolicy(
  item: AnnotatedItem,
  policy: FeatureAnnotationPolicy["modules"][number],
) {
  if (item.materialShapeObserved !== policy.materialShape) return false;
  const marks = new Set(item.focusMarksObserved);
  if (policy.requiredMarks.some((mark) => !marks.has(mark))) return false;
  if (policy.forbiddenMarks.some((mark) => marks.has(mark))) return false;
  if (policy.articleClasses === "none" && item.articleClassObserved.length !== 0) return false;
  if (
    policy.articleClasses === "shamsiyyah_only"
    && !(item.articleClassObserved.length === 1 && item.articleClassObserved[0] === "shamsiyyah")
  ) {
    return false;
  }
  return true;
}

function reviewReady(item: ReviewDraftItem) {
  const review = item.review;
  return review.exactBytesAndHashReviewed
    && review.evidenceBindingReviewed
    && review.featureMetadataReviewed
    && review.exerciseAuthorizationReviewed
    && review.stagePurityReviewed
    && review.decision === "approve"
    && review.reviewedByQualifiedContentReviewer;
}

function emptyReview(item: AnnotatedItem, metadataHash: string): ReviewDraftItem {
  return {
    id: item.id,
    sourcePdfPage: item.source.pdfPage,
    sourceOrder: item.source.sourceOrder,
    arabicUtf8Sha256: item.integrity.utf8Sha256,
    controlledMetadataSha256: metadataHash,
    review: {
      exactBytesAndHashReviewed: false,
      evidenceBindingReviewed: false,
      featureMetadataReviewed: false,
      exerciseAuthorizationReviewed: false,
      stagePurityReviewed: false,
      decision: null,
      reviewedByQualifiedContentReviewer: false,
      notes: "",
    },
  };
}

function metadataLabel(values: string[]) {
  return values.length ? values.join(" · ") : "Aucun";
}

export function ControlledManifestReviewPage({ onBack }: { onBack: () => void }) {
  const [packet, setPacket] = useState<LoadedPacket | null>(null);
  const [drafts, setDrafts] = useState<ReviewDraftItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadContracts() {
    const [registryResponse, policyResponse] = await Promise.all([
      fetch("/content/source-intake/progressive-support.json"),
      fetch("/content/source-intake/feature-annotation-policy.json"),
    ]);
    if (!registryResponse.ok || !policyResponse.ok) {
      throw new Error("Contrats progressifs indisponibles.");
    }
    const [registry, policyBuffer] = await Promise.all([
      registryResponse.json() as Promise<IntakeRegistry>,
      policyResponse.arrayBuffer(),
    ]);
    const policyText = new TextDecoder("utf-8", { fatal: true }).decode(policyBuffer);
    const policy = JSON.parse(policyText) as FeatureAnnotationPolicy;
    if (
      policy.schemaVersion !== "0.1"
      || policy.kind !== "itqan-progressive-feature-annotation-policy"
      || /[\u0600-\u06ff]/u.test(JSON.stringify(policy))
    ) {
      throw new Error("Politique item-level contrôlée invalide.");
    }
    return {
      registry,
      policy,
      policySha256: await sha256Bytes(policyBuffer),
    };
  }

  async function importPacket(files: FileList | null) {
    if (!files) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (files.length !== 3) {
        throw new Error("Sélectionne exactement les trois artifacts amont.");
      }
      const [contracts, ...loaded] = await Promise.all([
        loadContracts(),
        ...Array.from(files).map((file) => readJsonBytes(file)),
      ]);

      let promotedEntry: Awaited<ReturnType<typeof readJsonBytes>> | undefined;
      let annotationEntry: Awaited<ReturnType<typeof readJsonBytes>> | undefined;
      let annotatedEntry: Awaited<ReturnType<typeof readJsonBytes>> | undefined;

      for (const entry of loaded) {
        const value = entry.value as { kind?: string; status?: string };
        if (
          value.kind === "itqan-progressive-controlled-manifest-candidate"
          && value.status === "human_verified_repository_evidence_bound_pending_item_metadata"
        ) {
          if (promotedEntry) throw new Error("Deux candidats promus détectés.");
          promotedEntry = entry;
        } else if (
          value.kind === "itqan-progressive-item-feature-annotation"
          && value.status === "qualified_human_feature_annotation_complete"
        ) {
          if (annotationEntry) throw new Error("Deux annotations complètes détectées.");
          annotationEntry = entry;
        } else if (
          value.kind === "itqan-progressive-controlled-manifest-candidate"
          && value.status === "human_verified_repository_evidence_bound_item_metadata_annotated_pending_controlled_manifest_review"
        ) {
          if (annotatedEntry) throw new Error("Deux candidats annotés détectés.");
          annotatedEntry = entry;
        } else {
          throw new Error("Artifact inattendu dans le paquet de review.");
        }
      }

      if (!promotedEntry || !annotationEntry || !annotatedEntry) {
        throw new Error("Le paquet doit contenir promoted + annotation complète + annotated.");
      }

      const promoted = promotedEntry.value as PromotedCandidate;
      const annotation = annotationEntry.value as FeatureAnnotation;
      const annotated = annotatedEntry.value as AnnotatedCandidate;
      const { registry, policy, policySha256 } = contracts;

      if (
        promoted.sourceControl?.canonicalSourceId !== registry.sourceDocument.id
        || promoted.sourceControl?.canonicalSha256 !== registry.sourceDocument.sha256
        || promoted.sourceControl?.canonicalFile !== registry.sourceDocument.uploadedFilename
        || promoted.sourceControl?.visualPassesPerItem !== 2
        || promoted.sourceControl?.silentNormalization !== false
        || promoted.sourceControl?.modelOrOcrUsedAsAuthority !== false
      ) {
        throw new Error("Le candidat promu ne correspond pas à la source canonique.");
      }

      const module = registry.modules.find((entry) => entry.id === promoted.verificationScope?.moduleId);
      const modulePolicy = policy.modules.find((entry) => entry.id === module?.id);
      if (
        !module?.candidateBundle
        || promoted.verificationScope?.targetCategory !== module.targetCategory
        || !modulePolicy
        || modulePolicy.targetCategory !== module.targetCategory
      ) {
        throw new Error("Module ou politique de review incohérent.");
      }

      if (
        annotation.sourceControl?.canonicalSourceId !== registry.sourceDocument.id
        || annotation.sourceControl?.canonicalSourceSha256 !== registry.sourceDocument.sha256
        || annotation.sourceControl?.moduleId !== module.id
        || annotation.sourceControl?.targetCategory !== module.targetCategory
        || annotation.promotedCandidate?.sha256 !== promotedEntry.sha256
        || annotation.promotedCandidate?.itemCount !== promoted.items.length
        || annotation.featureAnnotationPolicy?.schemaVersion !== policy.schemaVersion
        || annotation.featureAnnotationPolicy?.sha256 !== policySha256
        || annotation.annotationPolicy?.authority !== "qualified_human"
        || annotation.annotationPolicy?.linguisticInferenceByAgent !== false
      ) {
        throw new Error("L’annotation complète ne correspond pas au candidat/politique actuels.");
      }

      if (
        annotated.annotationControl?.promotedCandidateSha256 !== promotedEntry.sha256
        || annotated.annotationControl?.featureAnnotationPolicySchemaVersion !== policy.schemaVersion
        || annotated.annotationControl?.featureAnnotationPolicySha256 !== policySha256
        || annotated.annotationControl?.authority !== "qualified_human"
        || annotated.annotationControl?.linguisticInferenceByAgent !== false
        || annotated.annotationControl?.featureInventoryComplete !== true
        || annotated.verificationScope?.moduleId !== module.id
        || annotated.verificationScope?.targetCategory !== module.targetCategory
        || annotated.activationPolicy?.eligibleForActiveLesson !== false
        || annotated.activationPolicy?.active !== false
        || !annotated.activationPolicy?.blockers?.includes("controlled_manifest_review_required")
        || !annotated.activationPolicy?.blockers?.includes("session_policy_rebuild_required")
      ) {
        throw new Error("Le candidat annoté n’est pas dans l’état contrôlé attendu.");
      }

      if (
        promoted.items.length === 0
        || annotation.items.length !== promoted.items.length
        || annotated.items.length !== promoted.items.length
      ) {
        throw new Error("Les trois artifacts ne couvrent pas exactement les mêmes items.");
      }

      const registeredResponse = await fetch(module.candidateBundle);
      if (!registeredResponse.ok) throw new Error("Bundle candidat enregistré indisponible.");
      const registeredBundle = await registeredResponse.json() as {
        kind: string;
        authoritative: boolean;
        sourceDocumentId: string;
        moduleId?: string;
        items: Array<{ sourcePdfPage: number; sourceOrder: number }>;
      };
      if (
        registeredBundle.kind !== "itqan-progressive-provisional-transcription"
        || registeredBundle.authoritative !== false
        || registeredBundle.sourceDocumentId !== registry.sourceDocument.id
        || registeredBundle.moduleId !== module.id
      ) {
        throw new Error("Bundle candidat enregistré invalide.");
      }
      const registeredPositions = new Set(
        registeredBundle.items.map((item) => `${item.sourcePdfPage}:${item.sourceOrder}`),
      );

      const promotedById = new Map(promoted.items.map((item) => [item.id, item]));
      const annotationById = new Map(annotation.items.map((item) => [item.id, item]));
      const seen = new Set<string>();
      const evidenceHashCache = new Map<string, string>();

      async function repositoryEvidenceHash(repositoryPath: string) {
        const url = evidenceUrl(repositoryPath);
        const cached = evidenceHashCache.get(url);
        if (cached) return cached;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Preuve repository indisponible.");
        const hash = await sha256Bytes(await response.arrayBuffer());
        evidenceHashCache.set(url, hash);
        return hash;
      }

      const nextDrafts: ReviewDraftItem[] = [];
      for (const item of annotated.items) {
        const original = promotedById.get(item.id);
        const feature = annotationById.get(item.id);
        const position = `${item.source?.pdfPage}:${item.source?.sourceOrder}`;
        if (
          !original
          || !feature
          || seen.has(item.id)
          || !registeredPositions.has(position)
          || item.source?.sourceId !== registry.sourceDocument.id
          || item.source?.file !== registry.sourceDocument.uploadedFilename
          || !module.sourcePdfPages.includes(item.source?.pdfPage)
          || item.source?.pdfPage !== original.source?.pdfPage
          || item.source?.sourceOrder !== original.source?.sourceOrder
          || item.arabicExact !== original.arabicExact
          || item.integrity?.utf8Sha256 !== original.integrity?.utf8Sha256
          || item.integrity?.normalizationApplied !== false
          || await sha256TextExact(item.arabicExact) !== item.integrity?.utf8Sha256
        ) {
          throw new Error("Dérive d’identité, source ou octets entre promoted et annotated.");
        }
        seen.add(item.id);

        if (
          item.verification?.visualPass1 !== true
          || item.verification?.visualPass2 !== true
          || item.verification?.ambiguous !== false
          || !sameJson(item.verification?.evidence, original.verification?.evidence)
          || !sameJson(item.verification?.evidenceIntegrity, original.verification?.evidenceIntegrity)
        ) {
          throw new Error("Dérive des contrôles ou preuves source.");
        }

        const [fullHash, cropHash] = await Promise.all([
          repositoryEvidenceHash(item.verification.evidence.full),
          repositoryEvidenceHash(item.verification.evidence.crop),
        ]);
        if (
          fullHash !== item.verification.evidenceIntegrity.fullSha256
          || cropHash !== item.verification.evidenceIntegrity.cropSha256
        ) {
          throw new Error("Les preuves déployées ne correspondent plus à leurs hashes.");
        }

        if (
          feature.sourcePdfPage !== item.source.pdfPage
          || feature.sourceOrder !== item.source.sourceOrder
          || feature.arabicUtf8Sha256 !== item.integrity.utf8Sha256
          || feature.annotation?.featureInventoryComplete !== true
          || feature.annotation?.targetFeatureConfirmed !== true
          || feature.annotation?.stagePurityConfirmed !== true
          || feature.annotation?.reviewedByQualifiedHuman !== true
          || feature.annotation?.ambiguous !== false
          || !sameJson(feature.annotation.focusMarksObserved, item.focusMarksObserved)
          || !sameJson(feature.annotation.articleClassObserved, item.articleClassObserved)
          || feature.annotation.materialShapeObserved !== item.materialShapeObserved
          || feature.annotation.hamzatWaslCandidate !== item.hamzatWaslCandidate
          || item.targetFeatureConfirmed !== true
          || item.stagePurityConfirmed !== true
          || item.metadataStatus !== "human_annotated_pending_controlled_manifest_review"
          || !sameJson(item.allowedExerciseTypes, [module.targetCategory])
          || item.eligibleForActiveLesson !== false
          || item.active !== false
          || !annotationMatchesPolicy(item, modulePolicy)
        ) {
          throw new Error("Dérive ou incohérence des métadonnées contrôlées.");
        }

        nextDrafts.push(emptyReview(item, await controlledMetadataSha256(item)));
      }

      if (seen.size !== promoted.items.length) {
        throw new Error("Le paquet de review ne couvre pas tous les items.");
      }

      setPacket({
        promoted,
        annotation,
        annotated,
        promotedSha256: promotedEntry.sha256,
        annotationSha256: annotationEntry.sha256,
        annotatedSha256: annotatedEntry.sha256,
        module,
        modulePolicy,
        featurePolicySha256: policySha256,
      });
      setDrafts(nextDrafts);
      setCurrentIndex(0);
      setNotice(
        `${nextDrafts.length} item${nextDrafts.length > 1 ? "s" : ""} prêt${nextDrafts.length > 1 ? "s" : ""} pour la review contrôlée. Les trois artifacts, preuves et métadonnées ont été reliés par leurs hashes exacts.`,
      );
    } catch {
      setPacket(null);
      setDrafts([]);
      setCurrentIndex(0);
      setError("Le paquet de review est incomplet, incohérent, obsolète ou ses preuves ne correspondent plus aux octets déployés.");
    } finally {
      setLoading(false);
    }
  }

  async function importReview(file: File | undefined) {
    if (!file || !packet) return;
    setError(null);
    setNotice(null);
    try {
      const { value } = await readJsonBytes(file);
      const review = value as ReviewArtifact;
      if (
        review.schemaVersion !== "0.1"
        || review.kind !== "itqan-progressive-controlled-manifest-review"
        || !["pending_qualified_content_review", "qualified_content_review_complete"].includes(review.status)
        || review.sourceControl?.canonicalSourceId !== packet.promoted.sourceControl.canonicalSourceId
        || review.sourceControl?.canonicalSourceSha256 !== packet.promoted.sourceControl.canonicalSha256
        || review.sourceControl?.moduleId !== packet.module.id
        || review.sourceControl?.targetCategory !== packet.module.targetCategory
        || review.inputs?.promotedCandidateSha256 !== packet.promotedSha256
        || review.inputs?.featureAnnotationSha256 !== packet.annotationSha256
        || review.inputs?.annotatedCandidateSha256 !== packet.annotatedSha256
        || review.inputs?.featureAnnotationPolicySha256 !== packet.featurePolicySha256
        || review.inputs?.itemCount !== packet.annotated.items.length
        || review.reviewPolicy?.authority !== "qualified_content_reviewer"
        || review.reviewPolicy?.contentRewriteAllowed !== false
        || review.reviewPolicy?.activationAllowed !== false
        || review.reviewPolicy?.itemExclusionAllowed !== false
        || review.reviewPolicy?.everyItemDecisionRequired !== true
        || !Array.isArray(review.items)
        || review.items.length !== packet.annotated.items.length
      ) {
        throw new Error("Review incompatible avec le paquet exact.");
      }

      const draftById = new Map(drafts.map((draft) => [draft.id, draft]));
      const seen = new Set<string>();
      const nextDrafts = review.items.map((item) => {
        const expected = draftById.get(item.id);
        if (
          !expected
          || seen.has(item.id)
          || item.sourcePdfPage !== expected.sourcePdfPage
          || item.sourceOrder !== expected.sourceOrder
          || item.arabicUtf8Sha256 !== expected.arabicUtf8Sha256
          || item.controlledMetadataSha256 !== expected.controlledMetadataSha256
        ) {
          throw new Error("Item de review incompatible avec le paquet exact.");
        }
        seen.add(item.id);
        const decision = item.review;
        if (
          typeof decision?.exactBytesAndHashReviewed !== "boolean"
          || typeof decision?.evidenceBindingReviewed !== "boolean"
          || typeof decision?.featureMetadataReviewed !== "boolean"
          || typeof decision?.exerciseAuthorizationReviewed !== "boolean"
          || typeof decision?.stagePurityReviewed !== "boolean"
          || ![null, "approve", "reject"].includes(decision?.decision ?? null)
          || typeof decision?.reviewedByQualifiedContentReviewer !== "boolean"
          || typeof decision?.notes !== "string"
        ) {
          throw new Error("Valeur de review invalide.");
        }
        return item;
      });

      setDrafts(nextDrafts);
      const firstIncomplete = nextDrafts.findIndex((item) => !reviewReady(item));
      setCurrentIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
      setNotice(
        review.status === "qualified_content_review_complete"
          ? "Review complète rechargée et liée au paquet exact."
          : "Brouillon de review rechargé. Reprise au premier item non approuvé.",
      );
    } catch {
      setError("Le brouillon de review ne correspond pas exactement aux trois artifacts chargés.");
    }
  }

  function updateCurrent(patch: Partial<ReviewDecision>) {
    setDrafts((current) => current.map((item, index) =>
      index === currentIndex
        ? { ...item, review: { ...item.review, ...patch } }
        : item
    ));
  }

  const currentDraft = drafts[currentIndex];
  const currentItem = packet?.annotated.items.find((item) => item.id === currentDraft?.id);
  const completedCount = useMemo(
    () => drafts.filter(reviewReady).length,
    [drafts],
  );
  const allComplete = Boolean(packet && drafts.length > 0 && completedCount === drafts.length);

  function buildArtifact(complete: boolean): ReviewArtifact | null {
    if (!packet) return null;
    return {
      schemaVersion: "0.1",
      kind: "itqan-progressive-controlled-manifest-review",
      status: complete ? "qualified_content_review_complete" : "pending_qualified_content_review",
      sourceControl: {
        canonicalSourceId: packet.promoted.sourceControl.canonicalSourceId,
        canonicalSourceSha256: packet.promoted.sourceControl.canonicalSha256,
        moduleId: packet.module.id,
        targetCategory: packet.module.targetCategory,
      },
      inputs: {
        promotedCandidateSha256: packet.promotedSha256,
        featureAnnotationSha256: packet.annotationSha256,
        annotatedCandidateSha256: packet.annotatedSha256,
        featureAnnotationPolicySha256: packet.featurePolicySha256,
        itemCount: packet.annotated.items.length,
      },
      reviewPolicy: {
        authority: "qualified_content_reviewer",
        contentRewriteAllowed: false,
        activationAllowed: false,
        itemExclusionAllowed: false,
        everyItemDecisionRequired: true,
      },
      items: drafts,
    };
  }

  function downloadArtifact(complete: boolean) {
    const artifact = buildArtifact(complete);
    if (!artifact || (complete && !allComplete)) return;
    const blob = new Blob([JSON.stringify(artifact, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `itqan-${packet?.module.id}-controlled-manifest-review-${complete ? "complete" : "draft"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page controlled-manifest-review-page">
      <header className="subpage-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Retour aux sources">
          <ArrowLeft size={20} />
        </button>
        <div>
          <span className="section-kicker">Manifest contrôlé</span>
          <h1>Revoir les items annotés</h1>
          <p>Cette étape ne modifie ni le texte arabe ni les métadonnées. Elle confirme que le paquet contrôlé peut passer à la reconstruction des séances.</p>
        </div>
      </header>

      <section className="intake-safety-card" aria-label="Frontière de review">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>Aucune activation ici</strong>
          <span>Une review complète retire uniquement le bloqueur de manifest contrôlé. La reconstruction des séances reste obligatoire et séparée.</span>
        </div>
      </section>

      <section className="intake-card">
        <label className="intake-upload">
          <FileUp size={18} aria-hidden="true" />
          <span>{loading ? "Validation des trois artifacts…" : "Charger promoted + annotation + annotated"}</span>
          <input
            type="file"
            accept="application/json,.json"
            multiple
            disabled={loading}
            onChange={(event) => void importPacket(event.target.files)}
          />
        </label>
        {packet && (
          <label className="intake-upload">
            <FileCheck2 size={18} aria-hidden="true" />
            <span>Reprendre depuis un brouillon de review</span>
            <input type="file" accept="application/json,.json" onChange={(event) => void importReview(event.target.files?.[0])} />
          </label>
        )}
        {packet && (
          <div className="intake-source-hint">
            <strong>{packet.module.id.replaceAll("_", " ")}</strong>
            <span>{packet.annotated.items.length} item{packet.annotated.items.length > 1 ? "s" : ""} · catégorie {packet.module.targetCategory}</span>
            <span>Annotated SHA : {packet.annotatedSha256.slice(0, 16)}…</span>
            <span>{packet.modulePolicy.guidanceFr}</span>
          </div>
        )}
        {notice && <p className="intake-notice">{notice}</p>}
        {error && <p className="intake-warning">{error}</p>}
      </section>

      {packet && currentDraft && currentItem && (
        <>
          <section className="annotation-progress-card">
            <div>
              <strong>Item {currentIndex + 1}/{drafts.length}</strong>
              <span>{completedCount}/{drafts.length} explicitement approuvés</span>
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
                <ImageIcon size={15} aria-hidden="true" /> Page complète
              </a>
              <a href={evidenceUrl(currentItem.verification.evidence.crop)} target="_blank" rel="noreferrer">
                <ImageIcon size={15} aria-hidden="true" /> Crop exact
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

            <section className="controlled-review-metadata">
              <div><span>Marques observées</span><strong>{metadataLabel(currentItem.focusMarksObserved)}</strong></div>
              <div><span>Article observé</span><strong>{metadataLabel(currentItem.articleClassObserved)}</strong></div>
              <div><span>Forme</span><strong>{currentItem.materialShapeObserved}</strong></div>
              <div><span>Hamzat-Wasl candidat</span><strong>{currentItem.hamzatWaslCandidate ? "Oui" : "Non"}</strong></div>
              <div><span>Exercice autorisé</span><strong>{currentItem.allowedExerciseTypes.join(" · ")}</strong></div>
              <div><span>Politique module</span><strong>{packet.modulePolicy.guidanceFr}</strong></div>
            </section>

            <div className="annotation-confirmations controlled-review-checks">
              <label><input type="checkbox" checked={currentDraft.review.exactBytesAndHashReviewed} onChange={(event) => updateCurrent({ exactBytesAndHashReviewed: event.target.checked })} /> Octets exacts et hash revus</label>
              <label><input type="checkbox" checked={currentDraft.review.evidenceBindingReviewed} onChange={(event) => updateCurrent({ evidenceBindingReviewed: event.target.checked })} /> Liaison aux preuves revue</label>
              <label><input type="checkbox" checked={currentDraft.review.featureMetadataReviewed} onChange={(event) => updateCurrent({ featureMetadataReviewed: event.target.checked })} /> Métadonnées item-level revues</label>
              <label><input type="checkbox" checked={currentDraft.review.exerciseAuthorizationReviewed} onChange={(event) => updateCurrent({ exerciseAuthorizationReviewed: event.target.checked })} /> Autorisation d’exercice revue</label>
              <label><input type="checkbox" checked={currentDraft.review.stagePurityReviewed} onChange={(event) => updateCurrent({ stagePurityReviewed: event.target.checked })} /> Pureté de l’étape revue</label>
              <label><input type="checkbox" checked={currentDraft.review.reviewedByQualifiedContentReviewer} onChange={(event) => updateCurrent({ reviewedByQualifiedContentReviewer: event.target.checked })} /> Revu par un réviseur de contenu qualifié</label>
            </div>

            <label className="intake-field">
              <span>Décision pour cet item</span>
              <select
                value={currentDraft.review.decision ?? ""}
                onChange={(event) => updateCurrent({
                  decision: event.target.value === "" ? null : event.target.value as "approve" | "reject",
                })}
              >
                <option value="">À décider</option>
                <option value="approve">Approuver pour le manifest contrôlé</option>
                <option value="reject">Rejeter et corriger en amont</option>
              </select>
            </label>

            <label className="intake-field">
              <span>Notes facultatives</span>
              <textarea rows={2} value={currentDraft.review.notes} onChange={(event) => updateCurrent({ notes: event.target.value })} />
            </label>

            <div className={reviewReady(currentDraft) ? "annotation-item-status is-ready" : "annotation-item-status is-pending"}>
              {reviewReady(currentDraft)
                ? <><CheckCircle2 size={16} aria-hidden="true" /><span>Item explicitement approuvé.</span></>
                : currentDraft.review.decision === "reject"
                  ? <span>Item rejeté : corrige l’artifact en amont avant une review complète.</span>
                  : <span>Chaque contrôle et la décision « approuver » sont requis.</span>}
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
              <strong>{completedCount}/{drafts.length} items approuvés</strong>
              <span>Le brouillon conserve les rejets et notes. La version complète exige l’approbation explicite de tous les items.</span>
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
