import { EMOTIONS } from '../lib/types'
import type { ReactionType } from '../lib/types'

type FilterValue = 'for_you' | ReactionType

interface EmotionFilterProps {
  active: FilterValue
  onChange: (value: FilterValue) => void
}

const ALL_FILTERS: { value: FilterValue; emoji?: string; label: string }[] = [
  { value: 'for_you', label: 'Для вас' },
  ...EMOTIONS.map(e => ({ value: e.type, emoji: e.emoji, label: e.label })),
]

export function EmotionFilter({ active, onChange }: EmotionFilterProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto py-3 px-4 no-scrollbar"
      style={{ scrollbarWidth: 'none' }}
    >
      {ALL_FILTERS.map(f => {
        const isActive = active === f.value
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: isActive ? 'var(--amber)' : 'rgba(201,132,62,0.1)',
              color: isActive ? '#140E0A' : 'var(--text-muted)',
              border: isActive ? 'none' : '1px solid var(--border)',
            }}
          >
            {f.emoji && <span>{f.emoji}</span>}
            <span>{f.label}</span>
          </button>
        )
      })}
    </div>
  )
}
