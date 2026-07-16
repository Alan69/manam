import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'

const schema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
})
type Form = z.infer<typeof schema>

export default function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) })

  async function onSubmit(v: Form) {
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: { data: { full_name: v.full_name } },
    })
    if (error) setError(error.message)
    else if (data.session) navigate('/profile')
    else setCheckEmail(true)
  }

  if (checkEmail) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <p className="text-lg">{t('auth.checkEmail')}</p>
        <Link to="/login" className="mt-4 inline-block text-amber-800 hover:underline">
          {t('auth.login')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-center">{t('auth.register')}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-3">
        <input
          {...register('full_name')}
          placeholder={t('auth.fullName')}
          className="w-full border border-stone-300 rounded-lg px-3 py-2.5"
        />
        <input
          {...register('email')}
          type="email"
          placeholder={t('auth.email')}
          className="w-full border border-stone-300 rounded-lg px-3 py-2.5"
        />
        <input
          {...register('password')}
          type="password"
          placeholder={t('auth.password')}
          className="w-full border border-stone-300 rounded-lg px-3 py-2.5"
        />
        {Object.values(formState.errors)[0] && (
          <p className="text-sm text-red-600">{Object.values(formState.errors)[0]?.message}</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={formState.isSubmitting}
          className="w-full bg-amber-700 text-white rounded-lg py-2.5 font-semibold hover:bg-amber-800 disabled:opacity-50"
        >
          {t('auth.register')}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-amber-800 hover:underline">
          {t('auth.haveAccount')}
        </Link>
      </p>
    </div>
  )
}
