import type { CSSProperties } from "react";
import { Check, LockKeyhole } from "lucide-react";

type PathNodeState = "done" | "current" | "available" | "locked";

export function PathNode({ index, title, state, x, y, labelSide, onActivate, lockedLabel }: { index: number; title: string; state: PathNodeState; x: number; y: number; labelSide: "left" | "right"; onActivate?: () => void; lockedLabel?: string }) {
  const style = { "--node-x": `${x}%`, "--node-y": `${y}px` } as CSSProperties;
  const interactive = state !== "locked";
  const status = state === "done" ? "Maîtrisé" : state === "current" ? "Priorité" : state === "available" ? "Disponible" : lockedLabel ?? "À venir";
  const statusId = `path-stage-${index}-status`;
  return <li className={`path-stop path-stop--${state} path-stop--label-${labelSide}`} style={style}><button type="button" disabled={!interactive} className="path-stop__orb" aria-label={title} aria-describedby={statusId} aria-current={state === "current" ? "step" : undefined} onClick={interactive ? onActivate : undefined}>{state === "done" ? <Check size={21} strokeWidth={2} aria-hidden="true" /> : state === "locked" ? <LockKeyhole size={17} strokeWidth={1.8} aria-hidden="true" /> : index}</button><div className="path-stop__label"><span id={statusId}>{status}</span><strong>{title}</strong></div></li>;
}
