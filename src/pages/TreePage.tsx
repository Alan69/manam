import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TreeView from '../components/TreeView'
import { usePersons } from '../lib/usePersons'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import type { Person } from '../lib/types'

export default function TreePage() {
  const { t } = useTranslation()
  const { persons, loading, error } = usePersons()
  const { session, profile } = useAuth()

  const [selected, setSelected] = useState<Person | null>(null)
  const [maxDepth, setMaxDepth] = useState(5)
  const [toggled, setToggled] = useState<Set<number>>(new Set())
  const [focusId, setFocusId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [linkMsg, setLinkMsg] = useState<string | null>(null)

  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons])

  const matches =
    query.trim().length >= 2
      ? persons.filter((p) => p.full_name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
      : []

  function onToggle(id: number) {
    setToggled((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // раскрыть всех предков найденного и отцентрировать
  function focusPerson(p: Person) {
    const chain: Person[] = []
    let cur: Person | undefined = p
    while (cur && cur.father_id != null) {
      cur = byId.get(cur.father_id)
      if (cur) chain.unshift(cur)
    }
    setToggled((prev) => {
      const next = new Set(prev)
      chain.forEach((a, i) => {
        const depth = i + 1
        const expandedByDefault = depth < maxDepth
        if (!expandedByDefault) next.add(a.id)
        else next.delete(a.id)
      })
      return next
    })
    setFocusId(null)
    setTimeout(() => setFocusId(p.id), 0)
    setSelected(p)
    setQuery('')
  }

  async function linkSelf() {
    if (!session || !selected) return
    const { error } = await supabase.from('submissions').insert({
      submitted_by: session.user.id,
      type: 'link_self',
      target_person_id: selected.id,
      payload: {},
    })
    setLinkMsg(error ? `${t('common.error')}: ${error.message}` : t('tree.linkSent'))
  }

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* панель управления */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap gap-2 items-start pointer-events-none">
        <div className="relative pointer-events-auto w-full sm:w-72">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tree.search')}
            className="w-full border border-stone-300 rounded-xl px-4 py-2.5 bg-white shadow-sm"
          />
          {matches.length > 0 && (
            <ul className="absolute mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-amber-50"
                    onClick={() => focusPerson(m)}
                  >
                    {m.full_name}
                    <span className="text-stone-400 text-sm"> {m.birth_year ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="pointer-events-auto flex items-center gap-2 bg-white border border-stone-300 rounded-xl px-3 py-2 shadow-sm text-sm">
          {t('tree.depth')}
          <select
            value={maxDepth}
            onChange={(e) => {
              setMaxDepth(Number(e.target.value))
              setToggled(new Set())
            }}
            className="bg-transparent"
          >
            {[3, 5, 7, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value={99}>{t('tree.all')}</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="h-full grid place-items-center text-stone-500">{t('common.loading')}</div>
      ) : error ? (
        <div className="h-full grid place-items-center text-red-600 px-6 text-center">{error}</div>
      ) : persons.length === 0 ? (
        <div className="h-full grid place-items-center text-stone-500 px-6 text-center">{t('tree.empty')}</div>
      ) : (
        <TreeView
          persons={persons}
          toggled={toggled}
          onToggle={onToggle}
          maxDepth={maxDepth}
          onSelect={(p) => setSelected(p)}
          focusId={focusId}
          notVerifiedLabel={t('tree.notVerified')}
        />
      )}

      {/* карточка персоны: bottom sheet на мобильном, панель справа на десктопе */}
      {selected && (
        <div className="absolute inset-x-0 bottom-0 md:inset-x-auto md:right-4 md:top-20 md:bottom-auto md:w-80 z-30">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl border border-stone-200 p-4 max-h-[60dvh] md:max-h-[70dvh] overflow-auto">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                {selected.photo_url && (
                  <img src={selected.photo_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                )}
                <div>
                  <h3 className="font-bold leading-tight">{selected.full_name}</h3>
                  <p className="text-sm text-stone-500">
                    {selected.birth_year ?? '—'}
                    {selected.is_alive ? ` · ${t('person.alive')}` : selected.death_year ? ` – ${selected.death_year}` : ''}
                  </p>
                  {!selected.is_verified && (
                    <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                      {t('tree.notVerified')}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelected(null)
                  setLinkMsg(null)
                }}
                className="text-stone-400 hover:text-slate-900 p-1"
              >
                ✕
              </button>
            </div>

            {selected.bio && <p className="mt-3 text-sm text-stone-600 line-clamp-4">{selected.bio}</p>}

            <div className="mt-4 flex flex-col gap-2 text-sm">
              <Link
                to={`/person/${selected.id}`}
                className="bg-amber-700 text-white text-center rounded-lg px-3 py-2.5 hover:bg-amber-800"
              >
                {t('tree.personPage')}
              </Link>
              <Link
                to={`/submit?father=${selected.id}`}
                className="border border-stone-300 text-center rounded-lg px-3 py-2.5 hover:bg-stone-50"
              >
                {t('tree.addChild')}
              </Link>
              {session && profile && !profile.person_id && (
                <button
                  onClick={linkSelf}
                  className="border border-amber-700 text-amber-800 rounded-lg px-3 py-2.5 hover:bg-amber-50"
                >
                  {t('tree.iAmThis')}
                </button>
              )}
              {!session && <p className="text-xs text-stone-400 text-center">{t('tree.loginToLink')}</p>}
              {linkMsg && <p className="text-sm text-center text-amber-800">{linkMsg}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
