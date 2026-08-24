import type { CSSProperties } from "react";
import { Check, LockKeyhole } from "lucide-react";

type PathNodeState = "done" | "current" | "available" | "locked";

export function PathNode({ index, title, state, x, y, labelSide, onActivate }: { index: number; title: string; state: PathNodeState; x: number; y: number; labelSide: "left" | "right"; onActivate?: () => void }) {
  const style = { "--node-x": `${x}%`, "--node-y": `${y}px` } as CSSProperties;
  const interactive = state !== "locked";
  return <div className={`path-stop path-stop--${state} path-stop--label-${labelSide}`} style={style}><button type="button" disabled={!interactive} className="path-stop__orb" aria-label={title} onClick={interactive ? onActivate : undefined}>{state === "done" ? <Check size={21} strokeWidth={2} /> : state === "locked" ? <LockKeyhole size={17} strokeWidth={1.8} /> : index}</button><div className="path-stop__label"><span>{state === "done" ? "Consolidé" : state === "current" ? "Priorité" : state === "available" ? "Disponible" : "À venir"}</span><strong>{title}</strong></div></div>;
}
