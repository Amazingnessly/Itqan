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
  items: Array<{
    moduleId: string;
    sourcePdfPage: number;
    sourceOrder: number;
    arabicCandidate: string;
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
    setReviewBatchIndex(0);
  }, [selectedModuleId]);

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
        if (bundle.kind !== "itqan-progressive-provisional-transcription" || bundle.authoritative !== false || bundle.sourceDocumentId !== registry.sourceDocument.id) {
          throw new Error("Bundle de propositions invalide.");
        }
        const nextEntries: EntryDraft[] = bundle.items.map((item, index) => {
          const module = registry.modules.find((candidateModule) => candidateModule.id === item.moduleId);
          if (!module || !module.sourcePdfPages.includes(item.sourcePdfPage)) {
            throw new Error(`Référence source invalide pour la proposition ${index + 1}.`);
          }
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
      const modules = new Map(registry.modules.map((module) => [module.id, module]));
      const nextEntries: EntryDraft[] = bundle.items.map((item, index) => {
        const module = modules.get(item.moduleId);
        if (!module || !module.sourcePdfPages.includes(item.sourcePdfPage)) {
          throw new Error(`Référence source invalide pour la proposition ${index + 1}.`);
        }
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
      setEntries(nextEntries);
      const first = nextEntries[0];
      if (first) setSelectedModuleId(first.moduleId);
      setNotice(`${nextEntries.length} proposition${nextEntries.length > 1 ? "s" : ""} chargée${nextEntries.length > 1 ? "s" : ""}. Elles restent non autoritatives jusqu’à ta vérification.`);
    } catch {
      setError("Le bundle de propositions est invalide ou ne correspond pas à cette source.");
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
          candidateCountInModule: moduleEntries.length,
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
        {registry && <div className="intake-source-hint"><strong>Source canonique</strong><span>{registry.sourceDocument.title} · {registry.sourceDocument.pageCount} pages</span><span>Empreinte attendue : {registry.sourceDocument.sha256.slice(0, 16)}…</span></div>}
        {notice && <p className="intake-notice">{notice}</p>}
        {error && <p className="intake-warning">{error}</p>}
      </section>

      <section className="intake-card">
        <label className="intake-field">
          <span>Étape du support</span>
          <select value={selectedModuleId} onChange={(event) => setSelectedModuleId(event.target.value)}>
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
            <span>{reviewEntries.length} proposition{reviewEntries.length > 1 ? "s" : ""} affichée{reviewEntries.length > 1 ? "s" : ""} sur {moduleEntries.length}</span>
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
            {hasWhitespaceEdge && <p className="intake-warning">Des espaces sont présents au début ou à la fin. Ils seront conservés exactement.</p>}
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
        {!exportReady && reviewEntries.length > 0 && <p>Pour exporter ce lot : PDF canonique vérifié, texte présent, deux vérifications visuelles et « Source ambiguë ? Non » pour chaque proposition affichée.</p>}
        <p className="intake-export-note"><FileDown size={14} aria-hidden="true" /> L’export conserve les octets exacts approuvés ; aucune normalisation automatique n’est appliquée.</p>
      </section>
    </main>
  );
}
