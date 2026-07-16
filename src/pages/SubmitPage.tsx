import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { usePersons } from '../lib/usePersons'
import { resizeImage } from '../lib/image'
import PersonSearch from '../components/PersonSearch'
import type { Person, PersonPayload } from '../lib/types'

const yearField = z
  .string()
  .regex(/^\d{3,4}$/, 'year')
  .optional()
  .or(z.literal(''))

const schema = z.object({
  full_name: z.string().min(2),
  birth_year: yearField,
  death_year: yearField,
  is_alive: z.boolean(),
  residence: z.string().optional(),
  bio: z.string().optional(),
})
type Form = z.infer<typeof schema>

export default function SubmitPage() {
  const { t } = useTranslation()
  const { session, loading } = useAuth()
  const { persons } = usePersons()
  const [params] = useSearchParams()
  const editId = params.get('edit') ? Number(params.get('edit')) : null
  const presetFatherId = params.get('father') ? Number(params.get('father')) : null

  const [step, setStep] = useState(0)
  const [father, setFather] = useState<Person | null>(null)
  const [data, setData] = useState<Form | null>(null)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editPerson = editId ? persons.find((p) => p.id === editId) : null

  const { register, handleSubmit, formState, reset, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { is_alive: true },
  })

  // преднастройка из query-параметров, когда персоны загрузились
  useEffect(() => {
    if (presetFatherId && !father) {
      const f = persons.find((p) => p.id === presetFatherId)
      if (f) setFather(f)
    }
    if (editPerson) {
      if (!father && editPerson.father_id) {
        const f = persons.find((p) => p.id === editPerson.father_id)
        if (f) setFather(f)
      }
      reset({
        full_name: editPerson.full_name,
        birth_year: editPerson.birth_year?.toString() ?? '',
        death_year: editPerson.death_year?.toString() ?? '',
        is_alive: editPerson.is_alive,
        residence: editPerson.residence ?? '',
        bio: editPerson.bio ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons.length])

  if (loading) return <p className="p-8 text-center text-stone-500">{t('common.loading')}</p>
  if (!session)
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <p>{t('submit.loginFirst')}</p>
        <div className="mt-4 flex gap-3 justify-center">
          <Link to="/login" className="bg-amber-700 text-white rounded-lg px-4 py-2">
            {t('nav.login')}
          </Link>
          <Link to="/register" className="border border-stone-300 rounded-lg px-4 py-2">
            {t('nav.register')}
          </Link>
        </div>
      </div>
    )

  const steps = [t('submit.stepFather'), t('submit.stepData'), t('submit.stepPhoto'), t('submit.stepPreview')]

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const blob = await resizeImage(file)
    setPhotoBlob(blob)
    setPhotoPreview(URL.createObjectURL(blob))
  }

  async function send() {
    if (!session || !data) return
    setSending(true)
    setError(null)
    try {
      let photo_url: string | undefined
      if (photoBlob) {
        const path = `${session.user.id}-${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage
          .from('photos')
          .upload(path, photoBlob, { contentType: 'image/jpeg' })
        if (upErr) throw upErr
        photo_url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
      }
      const payload: PersonPayload = {
        full_name: data.full_name,
        father_id: father?.id ?? null,
        birth_year: data.birth_year ? Number(data.birth_year) : null,
        death_year: data.death_year ? Number(data.death_year) : null,
        is_alive: data.is_alive,
        residence: data.residence || undefined,
        bio: data.bio || undefined,
        photo_url,
      }
      const { error: insErr } = await supabase.from('submissions').insert({
        submitted_by: session.user.id,
        type: editId ? 'edit_person' : 'add_person',
        target_person_id: editId,
        payload,
      })
      if (insErr) throw insErr
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  if (sent)
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <p className="text-lg">✅ {t('submit.sent')}</p>
        <Link to="/profile" className="mt-4 inline-block text-amber-800 hover:underline">
          {t('nav.profile')} →
        </Link>
      </div>
    )

  const isAlive = watch('is_alive')

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">{editId ? t('submit.editTitle') : t('submit.title')}</h1>

      {/* индикатор шагов */}
      <ol className="mt-6 flex gap-1">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`flex-1 text-center text-xs pb-2 border-b-2 ${
              i === step ? 'border-amber-700 font-semibold text-amber-800' : i < step ? 'border-amber-300 text-stone-500' : 'border-stone-200 text-stone-400'
            }`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">{t('submit.fatherHint')}</p>
            <PersonSearch
              persons={editId ? persons.filter((p) => p.id !== editId) : persons}
              value={father}
              onChange={setFather}
              placeholder={t('tree.search')}
            />
            <button
              disabled={!father && !editId}
              onClick={() => setStep(1)}
              className="w-full bg-amber-700 text-white rounded-lg py-2.5 font-semibold hover:bg-amber-800 disabled:opacity-40"
            >
              {t('submit.next')}
            </button>
          </div>
        )}

        {step === 1 && (
          <form
            onSubmit={handleSubmit((v) => {
              setData(v)
              setStep(2)
            })}
            className="space-y-3"
          >
            <input
              {...register('full_name')}
              placeholder={t('submit.fullName')}
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5"
            />
            {formState.errors.full_name && (
              <p className="text-sm text-red-600">{t('submit.fullName')}: min 2</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <input
                {...register('birth_year')}
                inputMode="numeric"
                placeholder={t('submit.birthYear')}
                className="border border-stone-300 rounded-lg px-3 py-2.5"
              />
              {!isAlive && (
                <input
                  {...register('death_year')}
                  inputMode="numeric"
                  placeholder={t('submit.deathYear')}
                  className="border border-stone-300 rounded-lg px-3 py-2.5"
                />
              )}
            </div>
            <label className="flex items-center gap-2 py-1">
              <input {...register('is_alive')} type="checkbox" className="w-5 h-5 accent-amber-700" />
              {t('submit.isAlive')}
            </label>
            <input
              {...register('residence')}
              placeholder={t('submit.residence')}
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5"
            />
            <textarea
              {...register('bio')}
              placeholder={t('submit.bio')}
              rows={4}
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="flex-1 border border-stone-300 rounded-lg py-2.5"
              >
                {t('submit.back')}
              </button>
              <button className="flex-1 bg-amber-700 text-white rounded-lg py-2.5 font-semibold hover:bg-amber-800">
                {t('submit.next')}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <label className="block text-sm text-stone-600">{t('submit.photo')}</label>
            <input type="file" accept="image/*" onChange={onPhotoChange} className="w-full" />
            {photoPreview && (
              <img src={photoPreview} alt="" className="w-32 h-32 rounded-2xl object-cover" />
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-stone-300 rounded-lg py-2.5">
                {t('submit.back')}
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-amber-700 text-white rounded-lg py-2.5 font-semibold hover:bg-amber-800"
              >
                {t('submit.next')}
              </button>
            </div>
          </div>
        )}

        {step === 3 && data && (
          <div className="space-y-4">
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center gap-3">
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-stone-200 grid place-items-center text-stone-400 text-xs">
                    {t('submit.noPhoto')}
                  </div>
                )}
                <div>
                  <p className="font-bold text-base">{data.full_name}</p>
                  <p className="text-stone-500">
                    {data.birth_year || '—'}
                    {data.is_alive ? ` · ${t('person.alive')}` : data.death_year ? ` – ${data.death_year}` : ''}
                  </p>
                </div>
              </div>
              <p>
                <span className="font-medium">{t('submit.father')}:</span> {father?.full_name ?? '—'}
              </p>
              {data.residence && (
                <p>
                  <span className="font-medium">{t('submit.residence')}:</span> {data.residence}
                </p>
              )}
              {data.bio && <p className="text-stone-600 whitespace-pre-line">{data.bio}</p>}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border border-stone-300 rounded-lg py-2.5">
                {t('submit.back')}
              </button>
              <button
                onClick={send}
                disabled={sending}
                className="flex-1 bg-amber-700 text-white rounded-lg py-2.5 font-semibold hover:bg-amber-800 disabled:opacity-50"
              >
                {t('submit.send')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
