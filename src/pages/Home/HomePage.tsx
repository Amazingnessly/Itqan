import { ArrowRight, Flame, Sparkles } from 'lucide-react'
import { Seal } from '../../components/ui/Seal'

export function HomePage({ onStart }: { onStart: () => void }) {
  return (
    <main className="page home-page">
      <header className="home-header">
        <div className="brand-lockup">
          <Seal size="md" />
          <div>
            <div className="brand-name">Itqān</div>
            <div className="brand-tagline">Maîtrise chaque unité. Lis avec fluidité.</div>
          </div>
        </div>
        <div className="streak-pill" aria-label="Régularité : 4 jours">
          <Flame size={17} />
          <strong>4</strong>
        </div>
      </header>

      <section className="hero-card">
        <img className="hero-card__visual" src="/illustrations/family-reference-temp.jpeg" alt="Scène familiale chaleureuse à table" />
        <div className="hero-card__veil" />
        <div className="hero-card__content">
          <span className="eyebrow"><Sparkles size={14} /> Mission du jour</span>
          <h1>Lis avec précision.<br />La fluidité suivra.</h1>
          <p>Une session courte pour consolider un seul geste de lecture à la fois.</p>
          <button className="primary-cta" type="button" onClick={onStart}>
            Commencer la session <ArrowRight size={19} />
          </button>
        </div>
      </section>

      <section className="home-progress" aria-label="Progression du jour">
        <div>
          <span className="section-kicker">Aujourd’hui</span>
          <strong>1 mission · environ 6 min</strong>
        </div>
        <div className="progress-track" aria-hidden="true"><span style={{ width: '38%' }} /></div>
        <p><strong>Prochain cap :</strong> stabiliser la lecture avant d’augmenter le rythme.</p>
      </section>
    </main>
  )
}
