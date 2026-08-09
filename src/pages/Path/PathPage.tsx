import { ChevronLeft } from 'lucide-react'
import { PathNode } from '../../components/path/PathNode'

const stages = [
  ['Unités de lecture', 'done'],
  ['Voyelles & Sukūn', 'current'],
  ['Shaddah', 'locked'],
  ['Article', 'locked'],
  ['Enchaînement', 'locked'],
  ['Lecture fluide', 'locked'],
] as const

export function PathPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="page path-page">
      <header className="subpage-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Retour à l’accueil"><ChevronLeft /></button>
        <div>
          <span className="section-kicker">Ton parcours</span>
          <h1>Construis une lecture sûre</h1>
          <p>Chaque étape se débloque quand la précision est suffisamment stable.</p>
        </div>
      </header>

      <section className="path-summary">
        <div><span>Niveau actuel</span><strong>🌿 Progression</strong></div>
        <div><span>Objectif</span><strong>Précision d’abord</strong></div>
      </section>

      <section className="learning-path" aria-label="Chemin d’apprentissage">
        <div className="learning-path__line" />
        {stages.map(([title, state], index) => (
          <PathNode key={title} index={index + 1} title={title} state={state} side={index % 2 === 0 ? 'left' : 'right'} />
        ))}
      </section>
    </main>
  )
}
