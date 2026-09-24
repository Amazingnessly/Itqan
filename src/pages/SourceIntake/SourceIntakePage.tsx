import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileDown, ImagePlus, Plus, ShieldCheck, Trash2 } from "lucide-react";

type IntakeModule = {
  id: string;
  targetCategory: string;
  sourceAssets: string[];
  sequence: number | null;
  scope?: string;
  role?: string;
  activation?: string;
};

type IntakeRegistry = {
  schemaVersion: string;
  status: string;
  evidencePersistence: string;
  modules: IntakeModule[];
};

type AmbiguityChoice = "unreviewed" | "no" | "yes";

type EntryDraft = {
  id: string;
  moduleId: string;
  sourceAsset: string;
  sourceOrder: number;
  arabicExact: string;
  visualPass1: boolean;
  visualPass2: boolean;
  ambiguity: AmbiguityChoice;
  notes: string;
};

type UploadedAsset = {
  file: File;
  previewUrl: string;
  sha256: string;
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

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const comma = value.indexOf(",");
      if (comma < 0) return reject(new Error("Encodage du fichier impossible."));
      resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function SourceIntakePage({ onBack }: { onBack: () => void }) {
  const [registry, setRegistry] = useState<IntakeRegistry | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [assets, setAssets] = useState<Record<string, UploadedAsset>>({});
  const assetsRef = useRef<Record<string, UploadedAsset>>({});
  const [entries, setEntries] = useState<EntryDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => () => {
    for (const asset of Object.values(assetsRef.current)) URL.revokeObjectURL(asset.previewUrl);
  }, []);

  const selectedModule = registry?.modules.find((module) => module.id === selectedModuleId);
  const moduleEntries = entries.filter((entry) => entry.moduleId === selectedModuleId);

  const requiredAssets = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.sourceAsset).filter(Boolean))),
    [entries],
  );

  const exportReady = entries.length > 0 && entries.every((entry) =>
    entry.arabicExact.length > 0
    && entry.visualPass1
    && entry.visualPass2
    && entry.ambiguity !== "unreviewed"
    && Boolean(assets[entry.sourceAsset])
  );

  async function handleAssetFiles(files: FileList | null) {
    if (!files) return;
    const next = { ...assets };
    for (const file of Array.from(files)) {
      const old = next[file.name];
      if (old) URL.revokeObjectURL(old.previewUrl);
      next[file.name] = {
        file,
        previewUrl: URL.createObjectURL(file),
        sha256: await sha256Bytes(await file.arrayBuffer()),
      };
    }
    setAssets(next);
  }

  function addEntry() {
    if (!selectedModule) return;
    const nextOrder = Math.max(0, ...moduleEntries.map((entry) => entry.sourceOrder)) + 1;
    setEntries((current) => [...current, {
      id: crypto.randomUUID(),
      moduleId: selectedModule.id,
      sourceAsset: selectedModule.sourceAssets[0] ?? "",
      sourceOrder: nextOrder,
      arabicExact: "",
      visualPass1: false,
      visualPass2: false,
      ambiguity: "unreviewed",
      notes: "",
    }]);
  }

  function updateEntry(id: string, patch: Partial<EntryDraft>) {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  async function exportBundle() {
    if (!registry || !exportReady) return;
    setExporting(true);
    setError(null);
    try {
      const assetPayload = await Promise.all(requiredAssets.map(async (filename) => {
        const uploaded = assets[filename];
        if (!uploaded) throw new Error(`Source manquante : ${filename}`);
        return {
          filename,
          mimeType: uploaded.file.type || "application/octet-stream",
          byteLength: uploaded.file.size,
          sha256: uploaded.sha256,
          base64: await readFileAsBase64(uploaded.file),
        };
      }));

      const itemPayload = await Promise.all(entries
        .slice()
        .sort((a, b) => {
          const moduleA = registry.modules.find((module) => module.id === a.moduleId)?.sequence ?? Number.MAX_SAFE_INTEGER;
          const moduleB = registry.modules.find((module) => module.id === b.moduleId)?.sequence ?? Number.MAX_SAFE_INTEGER;
          return moduleA - moduleB || a.sourceOrder - b.sourceOrder;
        })
        .map(async (entry) => ({
          moduleId: entry.moduleId,
          sourceAsset: entry.sourceAsset,
          sourceOrder: entry.sourceOrder,
          arabicExact: entry.arabicExact,
          integrity: {
            utf8Sha256: await sha256TextExact(entry.arabicExact),
            normalizationApplied: false,
            differsFromNfc: entry.arabicExact.normalize("NFC") !== entry.arabicExact,
          },
          verification: {
            visualPass1: entry.visualPass1,
            visualPass2: entry.visualPass2,
            ambiguous: entry.ambiguity === "yes",
            reviewedAmbiguity: true,
          },
          notes: entry.notes,
        })));

      const bundle = {
        schemaVersion: "0.1",
        kind: "itqan-progressive-human-source-intake",
        createdAt: new Date().toISOString(),
        sourceRegistrySchemaVersion: registry.schemaVersion,
        sourceRegistryStatus: registry.status,
        humanControlledEntry: true,
        agentTranscription: false,
        normalizationApplied: false,
        evidenceAssets: assetPayload,
        items: itemPayload,
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2) + "\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "itqan-progressive-human-intake.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("L’export a échoué. Vérifie les sources et les champs obligatoires.");
    } finally {
      setExporting(false);
    }
  }

  if (error && !registry) {
    return <main className="page source-intake-page"><header className="subpage-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Retour aux sources"><ArrowLeft size={20} /></button><div><span className="section-kicker">Préparation contrôlée</span><h1>Corpus progressif</h1><p>{error}</p></div></header></main>;
  }

  return (
    <main className="page source-intake-page">
      <header className="subpage-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Retour aux sources"><ArrowLeft size={20} /></button>
        <div>
          <span className="section-kicker">Préparation contrôlée</span>
          <h1>Corpus progressif</h1>
          <p>Saisis toi-même le texte exact observé sur les sources. Rien n’est corrigé, normalisé ou envoyé automatiquement.</p>
        </div>
      </header>

      <section className="intake-safety-card" aria-label="Règles de sécurité">
        <ShieldCheck size={18} aria-hidden="true" />
        <div><strong>Entrée humaine uniquement</strong><span>Deux vérifications visuelles obligatoires. L’export reste inactif tant que les contrôles ne sont pas complets.</span></div>
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
        {selectedModule && <div className="intake-source-hint"><strong>Sources attendues</strong>{selectedModule.sourceAssets.map((name) => <span key={name}>{name} · {assets[name] ? "chargée" : "manquante"}</span>)}</div>}
        <label className="intake-upload">
          <ImagePlus size={18} aria-hidden="true" />
          <span>Charger les captures source depuis cet appareil</span>
          <input type="file" accept="image/*" multiple onChange={(event) => void handleAssetFiles(event.target.files)} />
        </label>
      </section>

      {moduleEntries.map((entry) => {
        const uploaded = assets[entry.sourceAsset];
        const hasWhitespaceEdge = entry.arabicExact.length > 0 && entry.arabicExact !== entry.arabicExact.trim();
        return (
          <article className="intake-entry-card" key={entry.id}>
            <div className="intake-entry-card__top">
              <strong>Élément {entry.sourceOrder}</strong>
              <button type="button" className="intake-remove" onClick={() => removeEntry(entry.id)} aria-label={`Retirer l’élément ${entry.sourceOrder}`}><Trash2 size={16} /></button>
            </div>
            <label className="intake-field">
              <span>Capture source</span>
              <select value={entry.sourceAsset} onChange={(event) => updateEntry(entry.id, { sourceAsset: event.target.value })}>
                {(selectedModule?.sourceAssets ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            {uploaded && <img className="intake-preview" src={uploaded.previewUrl} alt={`Aperçu de ${entry.sourceAsset}`} />}
            <label className="intake-field">
              <span>Ordre dans la source</span>
              <input className="intake-order-input" type="number" min={1} step={1} value={entry.sourceOrder} onChange={(event) => updateEntry(entry.id, { sourceOrder: Math.max(1, Number(event.target.value) || 1) })} />
            </label>
            <label className="intake-field">
              <span>Texte exact saisi par le réviseur</span>
              <textarea dir="rtl" lang="ar" value={entry.arabicExact} onChange={(event) => updateEntry(entry.id, { arabicExact: event.target.value })} rows={2} autoComplete="off" spellCheck={false} />
            </label>
            {hasWhitespaceEdge && <p className="intake-warning">Attention : des espaces sont présents au début ou à la fin. Ils seront conservés exactement.</p>}
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

      <button className="secondary-cta intake-add" type="button" onClick={addEntry} disabled={!selectedModule}><Plus size={17} /> Ajouter un élément</button>

      <section className="intake-export-card">
        <div><strong>{entries.length} élément{entries.length > 1 ? "s" : ""} préparé{entries.length > 1 ? "s" : ""}</strong><span>{requiredAssets.length} capture{requiredAssets.length > 1 ? "s" : ""} utilisée{requiredAssets.length > 1 ? "s" : ""}</span></div>
        <button className="primary-cta" type="button" disabled={!exportReady || exporting} onClick={() => void exportBundle()}><FileDown size={18} />{exporting ? "Préparation…" : "Exporter le bundle contrôlé"}</button>
        {!exportReady && entries.length > 0 && <p>Pour exporter : texte exact, deux vérifications visuelles, statut d’ambiguïté et capture source sont requis pour chaque élément.</p>}
        {error && <p className="intake-warning">{error}</p>}
      </section>
    </main>
  );
}
