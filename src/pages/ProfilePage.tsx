import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import { usePersons } from '../lib/usePersons'
import type { Person, Submission } from '../lib/types'

const statusColor: Record<Submission['status'], string> = {
  pending: 'bg-stone-100 text-stone-700',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const { session, profile, loading, refreshProfile } = useAuth()
  const { persons } = usePersons()
  const [subs, setSubs] = useState<Submission[]>([])
  const [saved, setSaved] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name)
      setPhone(profile.phone ?? '')
    }
  }, [profile])

  useEffect(() => {
    if (!session) return
    supabase
      .from('submissions')
      .select('*')
      .eq('submitted_by', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSubs((data as Submission[]) ?? []))
  }, [session])

  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons])

  const branch = useMemo(() => {
    if (!profile?.person_id) return []
    const chain: Person[] = []
    let cur = byId.get(profile.person_id)
    while (cur) {
      chain.unshift(cur)
      cur = cur.father_id != null ? byId.get(cur.father_id) : undefined
    }
    return chain
  }, [profile, byId])

  if (loading) return <p className="p-8 text-center text-stone-500">{t('common.loading')}</p>
  if (!session) return <Navigate to="/login" replace />

  async function save() {
    if (!session) return
    await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', session.user.id)
    await refreshProfile()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">
      <h1 className="text-2xl font-bold">{t('profile.title')}</h1>

      {profile && !profile.person_id && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
          {t('profile.notLinked')}{' '}
          <Link to="/tree" className="text-amber-800 font-semibold hover:underline">
            {t('nav.tree')} →
          </Link>
        </div>
      )}

      <section>
        <h2 className="font-bold text-lg">{t('profile.myData')}</h2>
        <div className="mt-3 space-y-3">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('auth.fullName')}
            className="w-full border border-stone-300 rounded-lg px-3 py-2.5"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('profile.phone')}
            className="w-full border border-stone-300 rounded-lg px-3 py-2.5"
          />
          <button
            onClick={save}
            className="bg-amber-700 text-white rounded-lg px-5 py-2.5 hover:bg-amber-800"
          >
            {saved ? t('profile.saved') : t('profile.save')}
          </button>
        </div>
      </section>

      {branch.length > 0 && (
        <section>
          <h2 className="font-bold text-lg">{t('profile.myBranch')}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {branch.map((a, i) => (
              <span key={a.id} className="flex items-center gap-2">
                <Link
                  to={`/person/${a.id}`}
                  className={`rounded-full px-3 py-1 border ${
                    a.id === profile?.person_id
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-white border-stone-300 hover:border-amber-700'
                  }`}
                >
                  {a.full_name}
                </Link>
                {i < branch.length - 1 && <span className="text-amber-700">→</span>}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-bold text-lg">{t('profile.mySubmissions')}</h2>
        {subs.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">{t('profile.noSubmissions')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {subs.map((s) => (
              <li key={s.id} className="bg-white border border-stone-200 rounded-xl p-4 text-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium">
                    {t(`profile.type.${s.type}`)}
                    {s.payload.full_name ? `: ${s.payload.full_name}` : ''}
                    {s.type === 'link_self' && s.target_person_id
                      ? `: ${byId.get(s.target_person_id)?.full_name ?? '#' + s.target_person_id}`
                      : ''}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs ${statusColor[s.status]}`}>
                    {t(`profile.status.${s.status}`)}
                  </span>
                </div>
                <p className="text-stone-400 text-xs mt-1">
                  {new Date(s.created_at).toLocaleDateString()}
                </p>
                {s.moderator_comment && (
                  <p className="mt-2 text-stone-600">
                    {t('profile.comment')}: {s.moderator_comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
