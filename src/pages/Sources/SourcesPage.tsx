import { CONTROLLED_SOURCE_TRACEABILITY } from "../../learning/sourceTraceability.generated";

export function SourcesPage() {
  return (
    <main className="page simple-page">
      <span className="section-kicker">Traçabilité</span>
      <h1>Sources contrôlées</h1>
      <p>
        Les sources affichées ici sont dérivées des mêmes manifests contrôlés que les leçons actives.
        Aucun contenu arabe non vérifié ne peut entrer dans une leçon.
      </p>
      <div className="source-list">
        {CONTROLLED_SOURCE_TRACEABILITY.map((source) => (
          <article className="source-card" key={source.sourceId}>
            <span>Source contrôlée {source.sourceId}</span>
            <strong>{source.batchIds.length} lot{source.batchIds.length > 1 ? "s" : ""} vérifié{source.batchIds.length > 1 ? "s" : ""}</strong>
            <small>Lots : {source.batchIds.join(", ")}</small>
            <small>Pages PDF vérifiées : {source.verifiedPdfPages.join(", ")}</small>
            <small>Deux contrôles visuels par élément · aucune normalisation silencieuse · OCR non utilisé comme autorité</small>
          </article>
        ))}
      </div>
    </main>
  );
}
