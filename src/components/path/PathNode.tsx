import type { CSSProperties } from "react";
import { Check, LockKeyhole } from "lucide-react";

export function PathNode({
  index,
  title,
  state,
  x,
  y,
  labelSide,
  onActivate,
}: {
  index: number;
  title: string;
  state: "done" | "current" | "locked";
  x: number;
  y: number;
  labelSide: "left" | "right";
  onActivate?: () => void;
}) {
  const style = {
    "--node-x": `${x}%`,
    "--node-y": `${y}px`,
  } as CSSProperties;

  return (
    <div
      className={`path-stop path-stop--${state} path-stop--label-${labelSide}`}
      style={style}
    >
      <button
        type="button"
        disabled={state === "locked"}
        className="path-stop__orb"
        aria-label={title}
        onClick={state === "current" ? onActivate : undefined}
      >
        {state === "done" ? (
          <Check size={21} strokeWidth={2} />
        ) : state === "locked" ? (
          <LockKeyhole size={17} strokeWidth={1.8} />
        ) : (
          index
        )}
      </button>
      <div className="path-stop__label">
        <span>
          {state === "done"
            ? "Consolidé"
            : state === "current"
              ? "Priorité"
              : "À venir"}
        </span>
        <strong>{title}</strong>
      </div>
    </div>
  );
}
