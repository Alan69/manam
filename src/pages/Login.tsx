import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})
type Form = z.infer<typeof schema>

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) })

  async function onSubmit(v: Form) {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword(v)
    if (error) setError(error.message)
    else navigate('/profile')
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-center">{t('auth.login')}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-3">
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
        {(formState.errors.email || formState.errors.password) && (
          <p className="text-sm text-red-600">
            {formState.errors.email?.message ?? formState.errors.password?.message}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={formState.isSubmitting}
          className="w-full bg-amber-700 text-white rounded-lg py-2.5 font-semibold hover:bg-amber-800 disabled:opacity-50"
        >
          {t('auth.login')}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/register" className="text-amber-800 hover:underline">
          {t('auth.noAccount')}
        </Link>
      </p>
    </div>
  )
}
