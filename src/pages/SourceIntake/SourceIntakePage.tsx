import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileCheck2, FileDown, FileUp, ListChecks, Plus, ShieldCheck, Trash2 } from "lucide-react";

type IntakeModule = {
  id: string;
  targetCategory: string;
  sourceAssets: string[];
  sourcePdfPages: number[];
  sequence: number | null;
  scope?: string;
  role?: string;
  activation?: string;
  candidateBundle?: string;
  candidateCount?: number;
};

type SourceDocument = {
  id: string;
  title: string;
  pageCount: number;
  sha256: string;
  uploadedFilename: string;
};

type IntakeRegistry = {
  schemaVersion: string;
  status: string;
  evidencePersistence: string;
  sourceDocument: SourceDocument;
  modules: IntakeModule[];
};

type CandidateBundle = {
  schemaVersion: string;
  kind: "itqan-progressive-provisional-transcription";
  sourceDocumentId: string;
  authoritative: false;
  moduleId?: string;
  items: Array<{
    moduleId: string;
    sourcePdfPage: number;
    sourceOrder: number;
    arabicCandidate: string;
    notes?: string;
  }>;
};

type HumanVerificationBundle = {
  schemaVersion: "0.2";
  kind: "itqan-progressive-human-verification";
  verificationScope: {
    moduleId: string;
    targetCategory: string;
    candidateCountInModule?: number;
    itemCount?: number;
    partIndex?: number;
    partCount?: number;
    sourcePositions?: Array<{
      sourcePdfPage: number;
      sourceOrder: number;
    }>;
  };
  sourceDocument: {
    id: string;
    sha256: string;
  };
  humanVerificationAuthority: true;
  candidateTranscriptionAuthoritative: false;
  normalizationApplied: false;
  items: Array<{
    moduleId: string;
    sourcePdfPage: number;
    sourceOrder: number;
    arabicExact: string;
    candidateOrigin: "provisional_machine" | "human_manual";
    integrity: {
      utf8Sha256: string;
      normalizationApplied: false;
      differsFromNfc: boolean;
    };
    verification: {
      visualPass1: boolean;
      visualPass2: boolean;
      reviewedAmbiguity: boolean;
      ambiguous: boolean;
      humanVerified: boolean;
    };
    notes?: string;
  }>;
};

type AmbiguityChoice = "unreviewed" | "no" | "yes";

type EntryDraft = {
  id: string;
  moduleId: string;
  sourcePdfPage: number;
  sourceOrder: number;
  arabicExact: string;
  candidateOrigin: "provisional_machine" | "human_manual";
  visualPass1: boolean;
  visualPass2: boolean;
  ambiguity: AmbiguityChoice;
  notes: string;
};

type LocalPdf = {
  file: File;
  previewUrl: string;
  sha256: string;
};

const REVIEW_BATCH_SIZE = 20;

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(buffer: ArrayBuffer) {
  return toHex(await crypto.subtle.digest("SHA-256", buffer));
}

async function sha256TextExact(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function readJsonFile<T>(file: File) {
  return new Promise<T>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result ?? "")) as T);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file, "utf-8");
  });
}

export function SourceIntakePage({ onBack }: { onBack: () => void }) {
  const [registry, setRegistry] = useState<IntakeRegistry | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [sourcePdf, setSourcePdf] = useState<LocalPdf | null>(null);
  const sourcePdfRef = useRef<LocalPdf | null>(null);
  const autoLoadedModulesRef = useRef<Set<string>>(new Set());
  const [entries, setEntries] = useState<EntryDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reviewBatchIndex, setReviewBatchIndex] = useState(0);

  useEffect(() => {
    fetch("/content/source-intake/progressive-support.json")
      .then((response) => {
        if (!response.ok) throw new Error("Registre progressif indisponible.");
        return response.json() as Promise<IntakeRegistry>;
      })
      .then((value) => {
        setRegistry(value);
        const first = value.modules.find((module) => Number.isInteger(module.sequence)) ?? value.modules[0];
        setSelectedModuleId(first?.id ?? "");
      })
      .catch(() => setError("Impossible de charger le registre progressif."));
  }, []);

  useEffect(() => {
    sourcePdfRef.current = sourcePdf;
  }, [sourcePdf]);

  useEffect(() => () => {
    const current = sourcePdfRef.current;
    if (current) URL.revokeObjectURL(current.previewUrl);
  }, []);

  const selectedModule = registry?.modules.find((module) => module.id === selectedModuleId);
  const moduleEntries = entries.filter((entry) => entry.moduleId === selectedModuleId);
  const registeredCandidateCount = selectedModule?.candidateCount ?? moduleEntries.length;
  const orderedModuleEntries = useMemo(() => moduleEntries
    .slice()
    .sort((a, b) => a.sourcePdfPage - b.sourcePdfPage || a.sourceOrder - b.sourceOrder), [moduleEntries]);
  const reviewBatchCount = Math.max(1, Math.ceil(orderedModuleEntries.length / REVIEW_BATCH_SIZE));
  const reviewEntries = orderedModuleEntries.slice(
    reviewBatchIndex * REVIEW_BATCH_SIZE,
    (reviewBatchIndex + 1) * REVIEW_BATCH_SIZE,
  );
  const reviewEntryIds = new Set(reviewEntries.map((entry) => entry.id));
  const reviewPass1Count = reviewEntries.filter((entry) => entry.visualPass1).length;
  const reviewPass2Count = reviewEntries.filter((entry) => entry.visualPass2).length;
  const reviewAmbiguityReviewedCount = reviewEntries.filter((entry) => entry.ambiguity !== "unreviewed").length;
  const allReviewPass1 = reviewEntries.length > 0 && reviewPass1Count === reviewEntries.length;
  const allReviewPass2 = reviewEntries.length > 0 && reviewPass2Count === reviewEntries.length;
  const allReviewAmbiguityReviewed = reviewEntries.length > 0 && reviewAmbiguityReviewedCount === reviewEntries.length;

  useEffect(() => {
    setReviewBatchIndex((current) => Math.min(current, reviewBatchCount - 1));
  }, [reviewBatchCount]);

  useEffect(() => {
    if (!registry || !selectedModule?.candidateBundle || autoLoadedModulesRef.current.has(selectedModule.id)) return;
    autoLoadedModulesRef.current.add(selectedModule.id);
    fetch(selectedModule.candidateBundle)
      .then((response) => {
        if (!response.ok) throw new Error("Bundle de propositions indisponible.");
        return response.json() as Promise<CandidateBundle>;
      })
      .then((bundle) => {
        if (
          bundle.kind !== "itqan-progressive-provisional-transcription"
          || bundle.authoritative !== false
          || bundle.sourceDocumentId !== registry.sourceDocument.id
          || bundle.moduleId !== selectedModule.id
        ) {
          throw new Error("Bundle de propositions invalide.");
        }
        if (
          Number.isInteger(selectedModule.candidateCount)
          && selectedModule.candidateCount! > 0
          && bundle.items.length !== selectedModule.candidateCount
        ) {
          throw new Error("Le bundle enregistré ne correspond pas au nombre de positions du module.");
        }

        const autoLoadedPositions = new Set<string>();
        const nextEntries: EntryDraft[] = bundle.items.map((item, index) => {
          if (
            item.moduleId !== selectedModule.id
            || !selectedModule.sourcePdfPages.includes(item.sourcePdfPage)
            || !Number.isInteger(item.sourceOrder)
            || item.sourceOrder <= 0
          ) {
            throw new Error(`Référence source invalide pour la proposition ${index + 1}.`);
          }
          const key = `${item.sourcePdfPage}:${item.sourceOrder}`;
          if (autoLoadedPositions.has(key)) {
            throw new Error(`Position source dupliquée pour la proposition ${index + 1}.`);
          }
          autoLoadedPositions.add(key);
          return {
            id: crypto.randomUUID(),
            moduleId: item.moduleId,
            sourcePdfPage: item.sourcePdfPage,
            sourceOrder: item.sourceOrder,
            arabicExact: item.arabicCandidate,
            candidateOrigin: "provisional_machine",
            visualPass1: false,
            visualPass2: false,
            ambiguity: "unreviewed",
            notes: item.notes ?? "",
          };
        });
        setEntries((current) => {
          const retained = current.filter((entry) => entry.moduleId !== selectedModule.id);
          return [...retained, ...nextEntries];
        });
        setNotice(`${nextEntries.length} proposition${nextEntries.length > 1 ? "s" : ""} préremplie${nextEntries.length > 1 ? "s" : ""} pour cette étape. Compare-les au PDF avant validation.`);
      })
      .catch(() => {
        autoLoadedModulesRef.current.delete(selectedModule.id);
        setError("Impossible de charger automatiquement les propositions de cette étape.");
      });
  }, [registry, selectedModule]);

  const sourcePdfVerified = Boolean(
    registry
    && sourcePdf
    && sourcePdf.sha256 === registry.sourceDocument.sha256,
  );

  const exportReady = sourcePdfVerified && reviewEntries.length > 0 && reviewEntries.every((entry) =>
    entry.arabicExact.length > 0
    && entry.arabicExact === entry.arabicExact.trim()
    && entry.visualPass1
    && entry.visualPass2
    && entry.ambiguity === "no"
    && Number.isInteger(entry.sourcePdfPage)
    && entry.sourcePdfPage > 0
  );

  async function handleSourcePdf(file: File | undefined) {
    if (!file || !registry) return;
    setError(null);
    setNotice(null);
    const sha256 = await sha256Bytes(await file.arrayBuffer());
    if (sha256 !== registry.sourceDocument.sha256) {
      setError("Ce PDF ne correspond pas à la source canonique enregistrée pour ce corpus.");
      return;
    }
    if (sourcePdf) URL.revokeObjectURL(sourcePdf.previewUrl);
    setSourcePdf({ file, sha256, previewUrl: URL.createObjectURL(file) });
    setNotice("PDF source vérifié par empreinte SHA-256.");
  }

  async function importCandidates(file: File | undefined) {
    if (!file || !registry) return;
    setError(null);
    setNotice(null);
    try {
      const bundle = await readJsonFile<CandidateBundle>(file);
      if (bundle.kind !== "itqan-progressive-provisional-transcription" || bundle.authoritative !== false) {
        throw new Error("Type de bundle inattendu.");
      }
      if (bundle.sourceDocumentId !== registry.sourceDocument.id) {
        throw new Error("Les propositions ne correspondent pas au PDF canonique.");
      }
      if (!Array.isArray(bundle.items) || bundle.items.length === 0) {
        throw new Error("Le bundle de propositions est vide.");
      }

      const importedModuleIds = new Set(bundle.items.map((item) => item.moduleId));
      if (importedModuleIds.size !== 1) {
        throw new Error("Un import de propositions doit rester limité à un seul module.");
      }
      const importedModuleId = [...importedModuleIds][0];
      const importedModule = registry.modules.find((module) => module.id === importedModuleId);
      if (!importedModule?.candidateBundle) {
        throw new Error("Le module importé ne possède pas de bundle candidat enregistré.");
      }
      if (bundle.moduleId !== undefined && bundle.moduleId !== importedModule.id) {
        throw new Error("Le module déclaré par le bundle importé est incohérent.");
      }

      const registeredResponse = await fetch(importedModule.candidateBundle);
      if (!registeredResponse.ok) {
        throw new Error("Bundle de propositions enregistré indisponible.");
      }
      const registeredBundle = await registeredResponse.json() as CandidateBundle;
      if (
        registeredBundle.kind !== "itqan-progressive-provisional-transcription"
        || registeredBundle.authoritative !== false
        || registeredBundle.sourceDocumentId !== registry.sourceDocument.id
        || registeredBundle.moduleId !== importedModule.id
      ) {
        throw new Error("Bundle de propositions enregistré invalide.");
      }
      if (
        Number.isInteger(importedModule.candidateCount)
        && importedModule.candidateCount! > 0
        && registeredBundle.items.length !== importedModule.candidateCount
      ) {
        throw new Error("Le bundle enregistré ne correspond pas au nombre de positions du module.");
      }

      const registeredPositions = new Set<string>();
      for (const candidate of registeredBundle.items) {
        if (
          candidate.moduleId !== importedModule.id
          || !importedModule.sourcePdfPages.includes(candidate.sourcePdfPage)
          || !Number.isInteger(candidate.sourceOrder)
          || candidate.sourceOrder <= 0
        ) {
          throw new Error("Le bundle enregistré contient une position source invalide.");
        }
        const key = `${candidate.sourcePdfPage}:${candidate.sourceOrder}`;
        if (registeredPositions.has(key)) {
          throw new Error("Le bundle enregistré contient une position source dupliquée.");
        }
        registeredPositions.add(key);
      }

      const importedPositions = new Set<string>();
      const nextEntries: EntryDraft[] = bundle.items.map((item, index) => {
        if (
          item.moduleId !== importedModule.id
          || !importedModule.sourcePdfPages.includes(item.sourcePdfPage)
          || !Number.isInteger(item.sourceOrder)
          || item.sourceOrder <= 0
        ) {
          throw new Error(`Référence source invalide pour la proposition ${index + 1}.`);
        }
        const key = `${item.sourcePdfPage}:${item.sourceOrder}`;
        if (!registeredPositions.has(key) || importedPositions.has(key)) {
          throw new Error(`Position source non enregistrée ou dupliquée pour la proposition ${index + 1}.`);
        }
        importedPositions.add(key);
        return {
          id: crypto.randomUUID(),
          moduleId: item.moduleId,
          sourcePdfPage: item.sourcePdfPage,
          sourceOrder: item.sourceOrder,
          arabicExact: item.arabicCandidate,
          candidateOrigin: "provisional_machine",
          visualPass1: false,
          visualPass2: false,
          ambiguity: "unreviewed",
          notes: item.notes ?? "",
        };
      });

      autoLoadedModulesRef.current.add(importedModule.id);
      setEntries((current) => [
        ...current.filter((entry) => entry.moduleId !== importedModule.id),
        ...nextEntries,
      ]);
      setSelectedModuleId(importedModule.id);
      setReviewBatchIndex(0);
      const registeredCount = importedModule.candidateCount ?? registeredBundle.items.length;
      const subsetNote = nextEntries.length === registeredCount
        ? ""
        : ` sur ${registeredCount} positions enregistrées`;
      setNotice(
        `${nextEntries.length} proposition${nextEntries.length > 1 ? "s" : ""} chargée${nextEntries.length > 1 ? "s" : ""}${subsetNote}. Les brouillons des autres modules sont conservés et ces propositions restent non autoritatives jusqu’à ta vérification.`,
      );
    } catch {
      setError("Le bundle de propositions est invalide, dupliqué ou ne correspond pas au registre contrôlé.");
    }
  }

  async function importHumanVerification(file: File | undefined) {
    if (!file || !registry) return;
    setError(null);
    setNotice(null);
    try {
      const verification = await readJsonFile<HumanVerificationBundle>(file);
      if (
        verification.schemaVersion !== "0.2"
        || verification.kind !== "itqan-progressive-human-verification"
        || verification.humanVerificationAuthority !== true
        || verification.candidateTranscriptionAuthoritative !== false
        || verification.normalizationApplied !== false
      ) {
        throw new Error("Artifact de vérification inattendu.");
      }
      if (
        verification.sourceDocument?.id !== registry.sourceDocument.id
        || verification.sourceDocument?.sha256 !== registry.sourceDocument.sha256
      ) {
        throw new Error("La vérification ne correspond pas à la source canonique.");
      }

      const module = registry.modules.find((entry) => entry.id === verification.verificationScope?.moduleId);
      if (!module || !module.candidateBundle) {
        throw new Error("Module de vérification non enregistré.");
      }
      if (verification.verificationScope.targetCategory !== module.targetCategory) {
        throw new Error("La catégorie de la vérification ne correspond pas au registre.");
      }
      if (
        verification.verificationScope.candidateCountInModule !== undefined
        && verification.verificationScope.candidateCountInModule !== module.candidateCount
      ) {
        throw new Error("Le nombre de positions du module ne correspond pas au registre.");
      }
      if (!Array.isArray(verification.items) || verification.items.length === 0) {
        throw new Error("La vérification ne contient aucun élément.");
      }
      if (
        verification.verificationScope.itemCount !== undefined
        && verification.verificationScope.itemCount !== verification.items.length
      ) {
        throw new Error("Le nombre d’éléments vérifiés est incohérent.");
      }

      const response = await fetch(module.candidateBundle);
      if (!response.ok) throw new Error("Bundle de propositions enregistré indisponible.");
      const candidateBundle = await response.json() as CandidateBundle;
      if (
        candidateBundle.kind !== "itqan-progressive-provisional-transcription"
        || candidateBundle.authoritative !== false
        || candidateBundle.sourceDocumentId !== registry.sourceDocument.id
      ) {
        throw new Error("Bundle de propositions enregistré invalide.");
      }
      if (
        Number.isInteger(module.candidateCount)
        && module.candidateCount! > 0
        && candidateBundle.items.length !== module.candidateCount
      ) {
        throw new Error("Le bundle enregistré ne correspond pas au nombre de positions du module.");
      }

      const candidateByPosition = new Map<string, CandidateBundle["items"][number]>();
      for (const candidate of candidateBundle.items) {
        if (
          candidate.moduleId !== module.id
          || !module.sourcePdfPages.includes(candidate.sourcePdfPage)
          || !Number.isInteger(candidate.sourceOrder)
          || candidate.sourceOrder <= 0
        ) {
          throw new Error("Le bundle enregistré contient une position source invalide.");
        }
        const key = `${candidate.sourcePdfPage}:${candidate.sourceOrder}`;
        if (candidateByPosition.has(key)) {
          throw new Error("Le bundle enregistré contient une position source dupliquée.");
        }
        candidateByPosition.set(key, candidate);
      }

      const resumedByPosition = new Map<string, HumanVerificationBundle["items"][number]>();
      for (const item of verification.items) {
        if (
          item.moduleId !== module.id
          || !module.sourcePdfPages.includes(item.sourcePdfPage)
          || !Number.isInteger(item.sourceOrder)
          || item.sourceOrder <= 0
          || item.arabicExact.length === 0
          || item.arabicExact !== item.arabicExact.trim()
        ) {
          throw new Error("Un élément vérifié ne respecte pas la portée source du module.");
        }
        const key = `${item.sourcePdfPage}:${item.sourceOrder}`;
        if (!candidateByPosition.has(key) || resumedByPosition.has(key)) {
          throw new Error("Une position vérifiée est absente du bundle enregistré ou dupliquée.");
        }
        const exactHash = await sha256TextExact(item.arabicExact);
        if (
          item.integrity?.utf8Sha256 !== exactHash
          || item.integrity?.normalizationApplied !== false
          || item.integrity?.differsFromNfc !== (item.arabicExact.normalize("NFC") !== item.arabicExact)
          || item.verification?.visualPass1 !== true
          || item.verification?.visualPass2 !== true
          || item.verification?.reviewedAmbiguity !== true
          || item.verification?.ambiguous !== false
          || item.verification?.humanVerified !== true
        ) {
          throw new Error("Un élément vérifié échoue aux contrôles d’intégrité ou de revue humaine.");
        }
        resumedByPosition.set(key, item);
      }

      if (verification.verificationScope.sourcePositions !== undefined) {
        const exportedPositions = verification.items.map((item) => ({
          sourcePdfPage: item.sourcePdfPage,
          sourceOrder: item.sourceOrder,
        }));
        if (JSON.stringify(verification.verificationScope.sourcePositions) !== JSON.stringify(exportedPositions)) {
          throw new Error("Les positions déclarées ne correspondent pas aux éléments vérifiés.");
        }
      }

      const nextEntries: EntryDraft[] = candidateBundle.items.map((candidate) => {
        const key = `${candidate.sourcePdfPage}:${candidate.sourceOrder}`;
        const resumed = resumedByPosition.get(key);
        return {
          id: crypto.randomUUID(),
          moduleId: module.id,
          sourcePdfPage: candidate.sourcePdfPage,
          sourceOrder: candidate.sourceOrder,
          arabicExact: resumed?.arabicExact ?? candidate.arabicCandidate,
          candidateOrigin: resumed?.candidateOrigin ?? "provisional_machine",
          visualPass1: resumed?.verification.visualPass1 ?? false,
          visualPass2: resumed?.verification.visualPass2 ?? false,
          ambiguity: resumed ? "no" : "unreviewed",
          notes: resumed?.notes ?? candidate.notes ?? "",
        };
      });

      autoLoadedModulesRef.current.add(module.id);
      setEntries((current) => [
        ...current.filter((entry) => entry.moduleId !== module.id),
        ...nextEntries,
      ]);
      setSelectedModuleId(module.id);
      const requestedPart = verification.verificationScope.partIndex ?? 1;
      const maximumPart = Math.max(1, Math.ceil(nextEntries.length / REVIEW_BATCH_SIZE));
      setReviewBatchIndex(Math.min(Math.max(requestedPart - 1, 0), maximumPart - 1));
      setNotice(
        `${verification.items.length} élément${verification.items.length > 1 ? "s" : ""} vérifié${verification.items.length > 1 ? "s" : ""} repris depuis l’export. Les autres positions du module restent à vérifier.`,
      );
    } catch {
      setError("L’export de vérification est invalide, incohérent ou ne correspond plus au registre contrôlé.");
    }
  }

  function addManualEntry() {
    if (!selectedModule) return;
    const nextOrder = Math.max(0, ...moduleEntries.map((entry) => entry.sourceOrder)) + 1;
    setEntries((current) => [...current, {
      id: crypto.randomUUID(),
      moduleId: selectedModule.id,
      sourcePdfPage: selectedModule.sourcePdfPages[0] ?? 1,
      sourceOrder: nextOrder,
      arabicExact: "",
      candidateOrigin: "human_manual",
      visualPass1: false,
      visualPass2: false,
      ambiguity: "unreviewed",
      notes: "",
    }]);
  }

  function updateEntry(id: string, patch: Partial<EntryDraft>) {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function markReviewPass(pass: "visualPass1" | "visualPass2") {
    setEntries((current) => current.map((entry) => (
      reviewEntryIds.has(entry.id) ? { ...entry, [pass]: true } : entry
    )));
  }

  function markReviewUnambiguous() {
    setEntries((current) => current.map((entry) => (
      reviewEntryIds.has(entry.id) && entry.ambiguity === "unreviewed"
        ? { ...entry, ambiguity: "no" as AmbiguityChoice }
        : entry
    )));
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  async function exportBundle() {
    if (!registry || !sourcePdf || !exportReady) return;
    setExporting(true);
    setError(null);
    try {
      const itemPayload = await Promise.all(reviewEntries.map(async (entry) => ({
          moduleId: entry.moduleId,
          sourcePdfPage: entry.sourcePdfPage,
          sourceOrder: entry.sourceOrder,
          arabicExact: entry.arabicExact,
          candidateOrigin: entry.candidateOrigin,
          integrity: {
            utf8Sha256: await sha256TextExact(entry.arabicExact),
            normalizationApplied: false,
            differsFromNfc: entry.arabicExact.normalize("NFC") !== entry.arabicExact,
          },
          verification: {
            visualPass1: entry.visualPass1,
            visualPass2: entry.visualPass2,
            ambiguous: false,
            reviewedAmbiguity: true,
            humanVerified: true,
          },
          notes: entry.notes,
        })));

      const bundle = {
        schemaVersion: "0.2",
        kind: "itqan-progressive-human-verification",
        createdAt: new Date().toISOString(),
        sourceRegistrySchemaVersion: registry.schemaVersion,
        sourceRegistryStatus: registry.status,
        verificationScope: {
          moduleId: selectedModuleId,
          targetCategory: selectedModule?.targetCategory ?? null,
          coverage: "source_subset",
          candidateCountInModule: registeredCandidateCount,
          itemCount: reviewEntries.length,
          partIndex: reviewBatchIndex + 1,
          partCount: reviewBatchCount,
          sourcePositions: reviewEntries.map((entry) => ({
            sourcePdfPage: entry.sourcePdfPage,
            sourceOrder: entry.sourceOrder,
          })),
        },
        sourceDocument: {
          id: registry.sourceDocument.id,
          filename: sourcePdf.file.name,
          byteLength: sourcePdf.file.size,
          sha256: sourcePdf.sha256,
        },
        humanVerificationAuthority: true,
        candidateTranscriptionAuthoritative: false,
        normalizationApplied: false,
        items: itemPayload,
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2) + "\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const partSuffix = reviewBatchCount > 1 ? `-part-${reviewBatchIndex + 1}-of-${reviewBatchCount}` : "";
      anchor.download = `itqan-${selectedModuleId}-human-verification${partSuffix}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("L’export a échoué. Vérifie le PDF source et les contrôles obligatoires.");
    } finally {
      setExporting(false);
    }
  }

  if (error && !registry) {
    return <main className="page source-intake-page"><header className="subpage-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Retour aux sources"><ArrowLeft size={20} /></button><div><span className="section-kicker">Vérification contrôlée</span><h1>Corpus progressif</h1><p>{error}</p></div></header></main>;
  }

  return (
    <main className="page source-intake-page">
      <header className="subpage-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Retour aux sources"><ArrowLeft size={20} /></button>
        <div>
          <span className="section-kicker">Vérification contrôlée</span>
          <h1>Corpus progressif</h1>
          <p>Les propositions peuvent être préremplies automatiquement. Ton rôle est de les comparer au PDF, corriger si nécessaire, puis valider deux fois.</p>
        </div>
      </header>

      <section className="intake-safety-card" aria-label="Règles de sécurité">
        <ShieldCheck size={18} aria-hidden="true" />
        <div><strong>La vérification humaine reste l’autorité</strong><span>Une proposition automatique n’entre jamais dans les leçons sans deux contrôles visuels et une source non ambiguë.</span></div>
      </section>

      <section className="intake-card">
        <label className="intake-upload">
          <FileUp size={18} aria-hidden="true" />
          <span>{sourcePdfVerified ? "PDF source vérifié" : "Charger une fois le PDF source canonique"}</span>
          <input type="file" accept="application/pdf" onChange={(event) => void handleSourcePdf(event.target.files?.[0])} />
        </label>
        <label className="intake-upload">
          <ListChecks size={18} aria-hidden="true" />
          <span>Importer les propositions à vérifier</span>
          <input type="file" accept="application/json,.json" onChange={(event) => void importCandidates(event.target.files?.[0])} />
        </label>
        <label className="intake-upload">
          <FileCheck2 size={18} aria-hidden="true" />
          <span>Reprendre depuis un export de vérification</span>
          <input type="file" accept="application/json,.json" onChange={(event) => void importHumanVerification(event.target.files?.[0])} />
        </label>
        {registry && <div className="intake-source-hint"><strong>Source canonique</strong><span>{registry.sourceDocument.title} · {registry.sourceDocument.pageCount} pages</span><span>Empreinte attendue : {registry.sourceDocument.sha256.slice(0, 16)}…</span></div>}
        {notice && <p className="intake-notice">{notice}</p>}
        {error && <p className="intake-warning">{error}</p>}
      </section>

      <section className="intake-card">
        <label className="intake-field">
          <span>Étape du support</span>
          <select value={selectedModuleId} onChange={(event) => {
            setSelectedModuleId(event.target.value);
            setReviewBatchIndex(0);
          }}>
            {(registry?.modules ?? []).map((module) => (
              <option key={module.id} value={module.id}>{module.id.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        {selectedModule && <div className="intake-source-hint"><strong>Pages PDF de référence</strong><span>{selectedModule.sourcePdfPages.join(", ")}</span>{selectedModule.candidateBundle && <span>{selectedModule.candidateCount ?? moduleEntries.length} propositions préremplies disponibles</span>}</div>}
      </section>

      {moduleEntries.length > 0 && (
        <section className="intake-review-window" aria-label="Lot de vérification">
          <div>
            <strong>Lot {reviewBatchIndex + 1}/{reviewBatchCount}</strong>
            <span>
              {reviewEntries.length} proposition{reviewEntries.length > 1 ? "s" : ""} affichée{reviewEntries.length > 1 ? "s" : ""} sur {moduleEntries.length} chargée{moduleEntries.length > 1 ? "s" : ""}
              {moduleEntries.length !== registeredCandidateCount ? ` · ${registeredCandidateCount} positions enregistrées dans le module` : ""}
            </span>
          </div>
          {reviewBatchCount > 1 && (
            <div className="intake-review-window__actions">
              <button type="button" className="secondary-cta" disabled={reviewBatchIndex === 0} onClick={() => setReviewBatchIndex((current) => Math.max(0, current - 1))}>Lot précédent</button>
              <button type="button" className="secondary-cta" disabled={reviewBatchIndex >= reviewBatchCount - 1} onClick={() => setReviewBatchIndex((current) => Math.min(reviewBatchCount - 1, current + 1))}>Lot suivant</button>
            </div>
          )}
        </section>
      )}

      {reviewEntries.length > 0 && (
        <section className="intake-batch-card" aria-label="Contrôles groupés du lot">
          <div className="intake-batch-card__copy">
            <strong>Contrôle groupé après lecture</strong>
            <span>Utilise ces boutons seulement après avoir comparé chaque proposition affichée avec le PDF. Une correction individuelle ou une source ambiguë reste prioritaire.</span>
          </div>
          <div className="intake-batch-progress" aria-label="Progression des vérifications">
            <span>Passe 1 : {reviewPass1Count}/{reviewEntries.length}</span>
            <span>Passe 2 : {reviewPass2Count}/{reviewEntries.length}</span>
            <span>Ambiguïté : {reviewAmbiguityReviewedCount}/{reviewEntries.length}</span>
          </div>
          <div className="intake-batch-actions">
            <button type="button" className="secondary-cta" disabled={!sourcePdfVerified || allReviewPass1} onClick={() => markReviewPass("visualPass1")}>
              {allReviewPass1 ? "Passe 1 terminée" : "Confirmer la passe 1"}
            </button>
            <button type="button" className="secondary-cta" disabled={!sourcePdfVerified || !allReviewPass1 || allReviewPass2} onClick={() => markReviewPass("visualPass2")}>
              {allReviewPass2 ? "Passe 2 terminée" : "Confirmer la passe 2"}
            </button>
            <button type="button" className="secondary-cta" disabled={!sourcePdfVerified || !allReviewPass2 || allReviewAmbiguityReviewed} onClick={markReviewUnambiguous}>
              {allReviewAmbiguityReviewed ? "Ambiguïté renseignée" : "Confirmer les sources non ambiguës"}
            </button>
          </div>
        </section>
      )}

      {reviewEntries.map((entry) => {
        const hasWhitespaceEdge = entry.arabicExact.length > 0 && entry.arabicExact !== entry.arabicExact.trim();
        const pageAllowed = selectedModule?.sourcePdfPages.includes(entry.sourcePdfPage) ?? false;
        const pdfView = sourcePdfVerified && sourcePdf ? `${sourcePdf.previewUrl}#page=${entry.sourcePdfPage}&view=FitH` : null;
        return (
          <article className="intake-entry-card" key={entry.id}>
            <div className="intake-entry-card__top">
              <div><strong>Élément {entry.sourceOrder}</strong><span className="intake-candidate-status">{entry.candidateOrigin === "provisional_machine" ? "Proposition à vérifier" : "Saisie manuelle"}</span></div>
              <button type="button" className="intake-remove" onClick={() => removeEntry(entry.id)} aria-label={`Retirer l’élément ${entry.sourceOrder}`}><Trash2 size={16} /></button>
            </div>
            <div className="intake-entry-meta">
              <label className="intake-field">
                <span>Page PDF</span>
                <select value={entry.sourcePdfPage} onChange={(event) => updateEntry(entry.id, { sourcePdfPage: Number(event.target.value) })}>
                  {(selectedModule?.sourcePdfPages ?? []).map((page) => <option key={page} value={page}>{page}</option>)}
                </select>
              </label>
              <label className="intake-field">
                <span>Ordre dans la source</span>
                <input className="intake-order-input" type="number" min={1} step={1} value={entry.sourceOrder} onChange={(event) => updateEntry(entry.id, { sourceOrder: Math.max(1, Number(event.target.value) || 1) })} />
              </label>
            </div>
            {!pageAllowed && <p className="intake-warning">Cette page ne fait pas partie du module sélectionné.</p>}
            {pdfView && <object className="intake-pdf-preview" data={pdfView} type="application/pdf" aria-label={`PDF source, page ${entry.sourcePdfPage}`}><p>Le lecteur PDF intégré n’est pas disponible sur cet appareil.</p></object>}
            <label className="intake-field">
              <span>Proposition exacte à vérifier</span>
              <textarea dir="rtl" lang="ar" value={entry.arabicExact} onChange={(event) => updateEntry(entry.id, { arabicExact: event.target.value })} rows={2} autoComplete="off" spellCheck={false} />
            </label>
            {hasWhitespaceEdge && <p className="intake-warning">Des espaces sont présents au début ou à la fin. L’export est bloqué : corrige-les manuellement, sans normalisation automatique.</p>}
            <div className="intake-checks">
              <label><input type="checkbox" checked={entry.visualPass1} onChange={(event) => updateEntry(entry.id, { visualPass1: event.target.checked })} /> Vérification visuelle 1</label>
              <label><input type="checkbox" checked={entry.visualPass2} onChange={(event) => updateEntry(entry.id, { visualPass2: event.target.checked })} /> Vérification visuelle 2</label>
            </div>
            <label className="intake-field">
              <span>Source ambiguë ?</span>
              <select value={entry.ambiguity} onChange={(event) => updateEntry(entry.id, { ambiguity: event.target.value as AmbiguityChoice })}>
                <option value="unreviewed">À vérifier</option>
                <option value="no">Non</option>
                <option value="yes">Oui</option>
              </select>
            </label>
            <label className="intake-field">
              <span>Notes facultatives</span>
              <textarea value={entry.notes} onChange={(event) => updateEntry(entry.id, { notes: event.target.value })} rows={2} />
            </label>
          </article>
        );
      })}

      <button className="secondary-cta intake-add" type="button" onClick={addManualEntry} disabled={!selectedModule}><Plus size={17} /> Ajouter manuellement si nécessaire</button>

      <section className="intake-export-card">
        <div><strong>{reviewEntries.length} proposition{reviewEntries.length > 1 ? "s" : ""} dans ce lot</strong><span>{sourcePdfVerified ? "PDF vérifié" : "PDF à charger"}</span></div>
        <button className="primary-cta" type="button" disabled={!exportReady || exporting} onClick={() => void exportBundle()}><FileCheck2 size={18} />{exporting ? "Préparation…" : "Valider et exporter"}</button>
        {!exportReady && reviewEntries.length > 0 && <p>Pour exporter ce lot : PDF canonique vérifié, texte présent sans espace en bordure, deux vérifications visuelles et « Source ambiguë ? Non » pour chaque proposition affichée.</p>}
        <p className="intake-export-note"><FileDown size={14} aria-hidden="true" /> L’export conserve les octets exacts approuvés ; aucune normalisation automatique n’est appliquée.</p>
      </section>
    </main>
  );
}
