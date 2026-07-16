import { useState } from 'react'
import type { Person } from '../lib/types'

interface Props {
  persons: Person[]
  value: Person | null
  onChange: (p: Person | null) => void
  placeholder: string
}

// Поиск персоны по имени с выпадающим списком (выбор отца и т.п.)
export default function PersonSearch({ persons, value, onChange, placeholder }: Props) {
  const [q, setQ] = useState('')
  const matches =
    q.trim().length >= 1
      ? persons.filter((p) => p.full_name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
      : []

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 border border-stone-300 rounded-lg px-3 py-2 bg-white">
        <span>
          {value.full_name}
          {value.birth_year ? ` (${value.birth_year})` : ''}
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-stone-400 hover:text-red-600 px-2">
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-stone-300 rounded-lg px-3 py-2"
      />
      {matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-amber-50"
                onClick={() => {
                  onChange(p)
                  setQ('')
                }}
              >
                {p.full_name}
                <span className="text-stone-400 text-sm">
                  {' '}
                  {p.birth_year ?? ''} {p.generation ? `· ${p.generation}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
