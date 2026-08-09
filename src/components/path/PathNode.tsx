import { Check, LockKeyhole } from 'lucide-react'

export function PathNode({
  index,
  title,
  state,
  side,
}: {
  index: number
  title: string
  state: 'done' | 'current' | 'locked'
  side: 'left' | 'right'
}) {
  return (
    <div className={`path-node path-node--${side} path-node--${state}`}>
      <button type="button" disabled={state === 'locked'} className="path-node__orb" aria-label={title}>
        {state === 'done' ? <Check size={22} /> : state === 'locked' ? <LockKeyhole size={18} /> : index}
      </button>
      <div className="path-node__label">
        <span>{state === 'done' ? 'Consolidé' : state === 'current' ? 'Priorité' : 'À venir'}</span>
        <strong>{title}</strong>
      </div>
    </div>
  )
}
