import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePersons } from '../lib/usePersons'
import type { Person } from '../lib/types'

export default function PersonPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { persons, loading } = usePersons()

  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons])
  const person = byId.get(Number(id))

  const ancestors = useMemo(() => {
    if (!person) return []
    const chain: Person[] = []
    let cur: Person | undefined = person
    while (cur && cur.father_id != null) {
      cur = byId.get(cur.father_id)
      if (cur) chain.unshift(cur)
      else break
    }
    return chain
  }, [person, byId])

  const children = useMemo(
    () => persons.filter((p) => p.father_id === person?.id),
    [persons, person],
  )

  useEffect(() => {
    if (person) document.title = `${person.full_name} — Шежіре Манам`
    return () => {
      document.title = 'Шежіре — Манам'
    }
  }, [person])

  if (loading) return <p className="p-8 text-center text-stone-500">{t('common.loading')}</p>
  if (!person) return <p className="p-8 text-center text-stone-500">{t('person.notFound')}</p>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        {person.photo_url ? (
          <img
            src={person.photo_url}
            alt={person.full_name}
            className="w-32 h-32 rounded-2xl object-cover shadow"
          />
        ) : (
          <div className="w-32 h-32 rounded-2xl bg-stone-200 grid place-items-center text-4xl text-stone-400">
            {person.full_name[0]}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">{person.full_name}</h1>
          {!person.is_verified && (
            <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
              {t('tree.notVerified')}
            </span>
          )}
          <dl className="mt-3 text-sm space-y-1 text-stone-600">
            <div>
              <dt className="inline font-medium text-slate-900">{t('person.years')}: </dt>
              <dd className="inline">
                {person.birth_year ?? '—'}
                {person.is_alive ? ` (${t('person.alive')})` : ` – ${person.death_year ?? '?'}`}
              </dd>
            </div>
            {person.residence && (
              <div>
                <dt className="inline font-medium text-slate-900">{t('person.residence')}: </dt>
                <dd className="inline">{person.residence}</dd>
              </div>
            )}
            {person.generation && (
              <div>
                <dd className="inline">
                  {person.generation}-{t('person.generation')}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link
              to={`/submit?edit=${person.id}`}
              className="border border-stone-300 rounded-lg px-3 py-2 hover:bg-stone-50"
            >
              {t('person.suggestEdit')}
            </Link>
            <Link
              to={`/submit?father=${person.id}`}
              className="bg-amber-700 text-white rounded-lg px-3 py-2 hover:bg-amber-800"
            >
              {t('person.addChild')}
            </Link>
          </div>
        </div>
      </div>

      {person.bio && (
        <section className="mt-8">
          <h2 className="font-bold text-lg">{t('person.bio')}</h2>
          <p className="mt-2 text-stone-700 leading-relaxed whitespace-pre-line">{person.bio}</p>
        </section>
      )}

      {ancestors.length > 0 && (
        <section className="mt-8">
          <h2 className="font-bold text-lg">{t('person.ancestors')}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {ancestors.map((a) => (
              <span key={a.id} className="flex items-center gap-2">
                <Link
                  to={`/person/${a.id}`}
                  className="bg-white border border-stone-300 rounded-full px-3 py-1 hover:border-amber-700 hover:text-amber-800"
                >
                  {a.full_name}
                </Link>
                <span className="text-amber-700">→</span>
              </span>
            ))}
            <span className="bg-amber-700 text-white rounded-full px-3 py-1">{person.full_name}</span>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-bold text-lg">{t('person.children')}</h2>
        {children.length === 0 ? (
          <p className="mt-2 text-stone-500 text-sm">{t('person.noChildren')}</p>
        ) : (
          <ul className="mt-3 grid sm:grid-cols-2 gap-2">
            {children.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/person/${c.id}`}
                  className="block bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-amber-700"
                >
                  <span className="font-medium">{c.full_name}</span>
                  <span className="text-stone-400 text-sm"> {c.birth_year ?? ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
