import { ChevronLeft, Target } from "lucide-react";
import { PathNode } from "../../components/path/PathNode";

const stages = [
  { title: "Unités de lecture", state: "current", x: 31, y: 58, labelSide: "right" },
  { title: "Voyelles & Sukūn", state: "locked", x: 67, y: 168, labelSide: "left" },
  { title: "Shaddah", state: "locked", x: 37, y: 282, labelSide: "right" },
  { title: "Article", state: "locked", x: 69, y: 398, labelSide: "left" },
  { title: "Enchaînement", state: "locked", x: 34, y: 516, labelSide: "right" },
  { title: "Lecture fluide", state: "locked", x: 63, y: 632, labelSide: "left" },
] as const;

export function PathPage({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <main className="page path-page">
      <header className="path-header">
        <button
          className="icon-button"
          type="button"
          onClick={onBack}
          aria-label="Retour à l’accueil"
        >
          <ChevronLeft size={21} strokeWidth={1.8} />
        </button>
        <span className="section-kicker">Ton parcours</span>
        <h1>Construis une lecture sûre</h1>
        <p>La fluidité vient après une précision stable.</p>
      </header>

      <section className="path-status" aria-label="Statut du parcours">
        <div className="level-chip">
          <span aria-hidden="true">🌱</span> Découverte
        </div>
        <div className="path-priority">
          <Target size={16} strokeWidth={1.8} />
          <span>Unités de lecture</span>
        </div>
      </section>

      <section className="learning-journey" aria-label="Chemin d’apprentissage">
        <svg
          className="journey-line"
          viewBox="0 0 360 720"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="journey-line__base"
            d="M112 58 C252 100 280 132 241 168 C180 224 94 228 133 282 C184 352 282 330 248 398 C205 484 82 452 122 516 C171 595 255 580 227 632"
          />
        </svg>

        {stages.map((stage, index) => (
          <PathNode
            key={stage.title}
            index={index + 1}
            title={stage.title}
            state={stage.state}
            x={stage.x}
            y={stage.y}
            labelSide={stage.labelSide}
            onActivate={stage.state === "current" ? onStart : undefined}
          />
        ))}
      </section>
    </main>
  );
}
