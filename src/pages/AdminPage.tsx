import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { usePersons } from '../lib/usePersons'
import PersonSearch from '../components/PersonSearch'
import type { Person, PersonPayload, Profile, Submission } from '../lib/types'

type SubmissionRow = Submission & { submitter: { full_name: string } | null }

const PAYLOAD_KEYS: (keyof PersonPayload)[] = [
  'full_name',
  'father_id',
  'birth_year',
  'death_year',
  'is_alive',
  'residence',
  'bio',
  'photo_url',
]

export default function AdminPage() {
  const { t } = useTranslation()
  const { profile, loading } = useAuth()
  const [tab, setTab] = useState<'subs' | 'persons' | 'roles' | 'content'>('subs')

  if (loading) return <p className="p-8 text-center text-stone-500">{t('common.loading')}</p>
  if (!profile || profile.role === 'user') return <Navigate to="/" replace />

  const tabs = [
    { id: 'subs' as const, label: t('admin.submissions') },
    { id: 'persons' as const, label: t('admin.persons') },
    ...(profile.role === 'admin' ? [{ id: 'roles' as const, label: t('admin.roles') }] : []),
    { id: 'content' as const, label: t('admin.content') },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">{t('admin.title')}</h1>
      <div className="mt-4 flex gap-2 flex-wrap">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`rounded-lg px-4 py-2 text-sm ${
              tab === x.id ? 'bg-amber-700 text-white' : 'bg-white border border-stone-300'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === 'subs' && <SubmissionsTab />}
        {tab === 'persons' && <PersonsTab />}
        {tab === 'roles' && <RolesTab />}
        {tab === 'content' && <ContentTab />}
      </div>
    </div>
  )
}

function SubmissionsTab() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { persons, reload: reloadPersons } = usePersons()
  const [subs, setSubs] = useState<SubmissionRow[]>([])
  const [onlyPending, setOnlyPending] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons])

  async function load() {
    const { data } = await supabase
      .from('submissions')
      .select('*, submitter:profiles!submissions_submitted_by_fkey(full_name)')
      .order('created_at', { ascending: false })
    setSubs((data as SubmissionRow[]) ?? [])
  }
  useEffect(() => {
    load()
  }, [])

  function fieldLabel(k: string) {
    const map: Record<string, string> = {
      full_name: t('submit.fullName'),
      father_id: t('submit.father'),
      birth_year: t('submit.birthYear'),
      death_year: t('submit.deathYear'),
      is_alive: t('submit.isAlive'),
      residence: t('submit.residence'),
      bio: t('submit.bio'),
      photo_url: t('submit.stepPhoto'),
    }
    return map[k] ?? k
  }

  function renderValue(k: string, v: unknown) {
    if (v == null || v === '') return <span className="text-stone-300">—</span>
    if (k === 'father_id') return byId.get(Number(v))?.full_name ?? `#${v}`
    if (k === 'is_alive') return v ? '✓' : '✗'
    if (k === 'photo_url')
      return <img src={String(v)} alt="" className="w-10 h-10 rounded object-cover" />
    return String(v)
  }

  async function approve(id: number) {
    setBusy(id)
    const { error } = await supabase.rpc('approve_submission', { submission_id: id })
    if (error) alert(`${t('common.error')}: ${error.message}`)
    await Promise.all([load(), reloadPersons()])
    setBusy(null)
  }

  async function reject(id: number) {
    const comment = window.prompt(t('admin.rejectComment'))
    if (comment === null) return
    setBusy(id)
    const { error } = await supabase
      .from('submissions')
      .update({
        status: 'rejected',
        moderator_comment: comment,
        reviewed_by: session?.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) alert(`${t('common.error')}: ${error.message}`)
    await load()
    setBusy(null)
  }

  const visible = onlyPending ? subs.filter((s) => s.status === 'pending') : subs

  return (
    <div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyPending}
          onChange={(e) => setOnlyPending(e.target.checked)}
          className="w-4 h-4 accent-amber-700"
        />
        {t('admin.onlyPending')}
      </label>

      {visible.length === 0 ? (
        <p className="mt-6 text-stone-500 text-sm">{t('admin.empty')}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {visible.map((s) => {
            const target = s.target_person_id ? byId.get(s.target_person_id) : null
            const keys = PAYLOAD_KEYS.filter((k) => s.payload[k] !== undefined)
            return (
              <li key={s.id} className="bg-white border border-stone-200 rounded-xl p-4 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-semibold">{t(`profile.type.${s.type}`)}</span>
                    <span className="text-stone-400">
                      {' '}
                      · {t('admin.from')}: {s.submitter?.full_name ?? '?'} ·{' '}
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span
                    className={`text-xs rounded-full px-2.5 py-0.5 ${
                      s.status === 'pending'
                        ? 'bg-stone-100'
                        : s.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {t(`profile.status.${s.status}`)}
                  </span>
                </div>

                {s.type === 'link_self' ? (
                  <p className="mt-2">
                    → {target?.full_name ?? `#${s.target_person_id}`}
                    {target?.birth_year ? ` (${target.birth_year})` : ''}
                  </p>
                ) : (
                  <table className="mt-3 w-full">
                    <thead>
                      <tr className="text-left text-xs text-stone-400">
                        <th className="py-1 pr-2 font-normal">{t('admin.field')}</th>
                        {s.type === 'edit_person' && (
                          <th className="py-1 pr-2 font-normal">{t('admin.current')}</th>
                        )}
                        <th className="py-1 font-normal">{t('admin.proposed')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((k) => {
                        const current = target ? (target as unknown as Record<string, unknown>)[k] : undefined
                        const proposed = s.payload[k]
                        const changed =
                          s.type === 'edit_person' && String(current ?? '') !== String(proposed ?? '')
                        return (
                          <tr key={k} className={changed ? 'bg-amber-50' : ''}>
                            <td className="py-1 pr-2 text-stone-500">{fieldLabel(k)}</td>
                            {s.type === 'edit_person' && (
                              <td className="py-1 pr-2">{renderValue(k, current)}</td>
                            )}
                            <td className={`py-1 ${changed ? 'font-semibold' : ''}`}>
                              {renderValue(k, proposed)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}

                {s.moderator_comment && (
                  <p className="mt-2 text-stone-500">
                    {t('profile.comment')}: {s.moderator_comment}
                  </p>
                )}

                {s.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => approve(s.id)}
                      disabled={busy === s.id}
                      className="bg-green-700 text-white rounded-lg px-4 py-2 hover:bg-green-800 disabled:opacity-50"
                    >
                      {t('admin.approve')}
                    </button>
                    <button
                      onClick={() => reject(s.id)}
                      disabled={busy === s.id}
                      className="border border-red-300 text-red-700 rounded-lg px-4 py-2 hover:bg-red-50 disabled:opacity-50"
                    >
                      {t('admin.reject')}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function PersonsTab() {
  const { t } = useTranslation()
  const { persons, reload } = usePersons()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Person | null>(null)
  const [form, setForm] = useState<Partial<Person>>({})
  const [newName, setNewName] = useState('')
  const [newFather, setNewFather] = useState<Person | null>(null)

  const visible = persons
    .filter((p) => p.full_name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 50)

  function startEdit(p: Person) {
    setEditing(p)
    setForm({
      full_name: p.full_name,
      birth_year: p.birth_year,
      death_year: p.death_year,
      residence: p.residence,
      is_verified: p.is_verified,
      bio: p.bio,
    })
  }

  async function saveEdit() {
    if (!editing) return
    const { error } = await supabase.from('persons').update(form).eq('id', editing.id)
    if (error) alert(`${t('common.error')}: ${error.message}`)
    setEditing(null)
    reload()
  }

  async function remove(p: Person) {
    if (!confirm(t('admin.deleteConfirm'))) return
    const { error } = await supabase.from('persons').delete().eq('id', p.id)
    if (error) alert(`${t('common.error')}: ${error.message}`)
    reload()
  }

  async function create() {
    if (newName.trim().length < 2) return
    const { error } = await supabase.from('persons').insert({
      full_name: newName.trim(),
      father_id: newFather?.id ?? null,
      is_verified: true,
    })
    if (error) alert(`${t('common.error')}: ${error.message}`)
    setNewName('')
    setNewFather(null)
    reload()
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-xl p-4">
        <h3 className="font-semibold text-sm">{t('admin.newPerson')}</h3>
        <div className="mt-2 grid sm:grid-cols-3 gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('submit.fullName')}
            className="border border-stone-300 rounded-lg px-3 py-2"
          />
          <PersonSearch persons={persons} value={newFather} onChange={setNewFather} placeholder={t('submit.father')} />
          <button onClick={create} className="bg-amber-700 text-white rounded-lg px-4 py-2 hover:bg-amber-800">
            {t('admin.create')}
          </button>
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('common.search')}
        className="w-full border border-stone-300 rounded-lg px-3 py-2"
      />

      <ul className="space-y-2">
        {visible.map((p) => (
          <li key={p.id} className="bg-white border border-stone-200 rounded-xl p-3 text-sm">
            {editing?.id === p.id ? (
              <div className="space-y-2">
                <input
                  value={form.full_name ?? ''}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={form.birth_year ?? ''}
                    onChange={(e) => setForm({ ...form, birth_year: e.target.value ? Number(e.target.value) : null })}
                    placeholder={t('submit.birthYear')}
                    className="border border-stone-300 rounded-lg px-3 py-2"
                  />
                  <input
                    value={form.death_year ?? ''}
                    onChange={(e) => setForm({ ...form, death_year: e.target.value ? Number(e.target.value) : null })}
                    placeholder={t('submit.deathYear')}
                    className="border border-stone-300 rounded-lg px-3 py-2"
                  />
                </div>
                <input
                  value={form.residence ?? ''}
                  onChange={(e) => setForm({ ...form, residence: e.target.value })}
                  placeholder={t('submit.residence')}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2"
                />
                <textarea
                  value={form.bio ?? ''}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder={t('submit.bio')}
                  rows={3}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_verified ?? false}
                    onChange={(e) => setForm({ ...form, is_verified: e.target.checked })}
                    className="w-4 h-4 accent-amber-700"
                  />
                  {t('admin.verified')}
                </label>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="bg-amber-700 text-white rounded-lg px-4 py-2">
                    {t('common.save')}
                  </button>
                  <button onClick={() => setEditing(null)} className="border border-stone-300 rounded-lg px-4 py-2">
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="font-medium">{p.full_name}</span>
                  <span className="text-stone-400">
                    {' '}
                    {p.birth_year ?? ''} · {p.generation ?? '?'}-{t('person.generation')}
                  </span>
                  {!p.is_verified && (
                    <span className="ml-2 text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                      {t('tree.notVerified')}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(p)} className="text-amber-800 hover:underline">
                    ✎
                  </button>
                  <button onClick={() => remove(p)} className="text-red-600 hover:underline">
                    {t('admin.delete')}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function RolesTab() {
  const { t } = useTranslation()
  const [profiles, setProfiles] = useState<Profile[]>([])

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setProfiles((data as Profile[]) ?? [])
  }
  useEffect(() => {
    load()
  }, [])

  async function setRole(id: string, role: string) {
    const { error } = await supabase.rpc('set_user_role', { target: id, new_role: role })
    if (error) alert(`${t('common.error')}: ${error.message}`)
    load()
  }

  return (
    <ul className="space-y-2">
      {profiles.map((p) => (
        <li
          key={p.id}
          className="bg-white border border-stone-200 rounded-xl p-3 text-sm flex items-center justify-between gap-2"
        >
          <span>
            {p.full_name} {p.phone && <span className="text-stone-400">· {p.phone}</span>}
          </span>
          <select
            value={p.role}
            onChange={(e) => setRole(p.id, e.target.value)}
            className="border border-stone-300 rounded-lg px-2 py-1"
          >
            <option value="user">user</option>
            <option value="moderator">moderator</option>
            <option value="admin">admin</option>
          </select>
        </li>
      ))}
    </ul>
  )
}

function ContentTab() {
  const { t } = useTranslation()
  const [ru, setRu] = useState('')
  const [kk, setKk] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('site_content')
      .select('ru, kk')
      .eq('key', 'home_history')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRu(data.ru)
          setKk(data.kk)
        }
      })
  }, [])

  async function save() {
    const { error } = await supabase
      .from('site_content')
      .upsert({ key: 'home_history', ru, kk, updated_at: new Date().toISOString() })
    if (error) alert(`${t('common.error')}: ${error.message}`)
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">{t('admin.historyRu')}</label>
      <textarea
        value={ru}
        onChange={(e) => setRu(e.target.value)}
        rows={6}
        className="w-full border border-stone-300 rounded-lg px-3 py-2"
      />
      <label className="block text-sm font-medium">{t('admin.historyKk')}</label>
      <textarea
        value={kk}
        onChange={(e) => setKk(e.target.value)}
        rows={6}
        className="w-full border border-stone-300 rounded-lg px-3 py-2"
      />
      <button onClick={save} className="bg-amber-700 text-white rounded-lg px-5 py-2.5 hover:bg-amber-800">
        {saved ? t('profile.saved') : t('admin.saveContent')}
      </button>
    </div>
  )
}
