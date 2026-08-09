import { BookOpenCheck, House, Map, RotateCcw, UserRound } from 'lucide-react'
import type { AppRoute } from '../../app/routes'

const items = [
  { id: 'home' as const, label: 'Accueil', icon: House },
  { id: 'path' as const, label: 'Parcours', icon: Map },
  { id: 'review' as const, label: 'Révision', icon: RotateCcw },
  { id: 'sources' as const, label: 'Sources', icon: BookOpenCheck },
  { id: 'profile' as const, label: 'Profil', icon: UserRound },
]

export function BottomNav({ current, onChange }: { current: AppRoute; onChange: (route: AppRoute) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={current === id ? 'bottom-nav__item is-active' : 'bottom-nav__item'}
          type="button"
          onClick={() => onChange(id)}
          aria-current={current === id ? 'page' : undefined}
        >
          <Icon size={20} strokeWidth={1.9} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
