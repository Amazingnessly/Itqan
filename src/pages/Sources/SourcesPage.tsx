import { sourceManifest } from '../../content/manifest'

export function SourcesPage() {
  return (
    <main className="page simple-page">
      <span className="section-kicker">Traçabilité</span>
      <h1>Sources contrôlées</h1>
      <p>Aucun contenu arabe non vérifié ne peut entrer dans une leçon active.</p>
      <div className="source-list">
        {sourceManifest.map((source, index) => (
          <article className="source-card" key={source.id}>
            <span>Support {index + 1}</span>
            <strong>{source.pages} pages scannées</strong>
            <small>Disponible · contrôle visuel requis</small>
          </article>
        ))}
      </div>
    </main>
  )
}
