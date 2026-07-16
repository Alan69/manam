import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

const CHAIN = ['Аргын', 'Мейрам', 'Куандық', 'Темеш', 'Манам']

export default function Home() {
  const { t, i18n } = useTranslation()
  const [history, setHistory] = useState('')

  useEffect(() => {
    supabase
      .from('site_content')
      .select('ru, kk')
      .eq('key', 'home_history')
      .maybeSingle()
      .then(({ data }) => {
        if (data) setHistory(i18n.language === 'kk' ? data.kk : data.ru)
      })
  }, [i18n.language])

  return (
    <div>
      <section className="bg-gradient-to-b from-amber-800 to-amber-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <h1 className="text-3xl md:text-5xl font-bold">{t('home.title')}</h1>
          <p className="mt-3 text-amber-200 text-sm md:text-base">{t('home.subtitle')}</p>
          <p className="mt-6 max-w-2xl mx-auto text-amber-50/90">{t('home.lead')}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/tree"
              className="bg-white text-amber-900 font-semibold px-6 py-3 rounded-xl hover:bg-amber-100"
            >
              {t('home.openTree')}
            </Link>
            <Link
              to="/submit"
              className="border border-amber-300 text-white px-6 py-3 rounded-xl hover:bg-amber-800"
            >
              {t('home.addSelf')}
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm md:text-base">
          {CHAIN.map((name, i) => (
            <span key={name} className="flex items-center gap-2">
              <span className="bg-white border border-stone-300 rounded-full px-4 py-1.5 font-medium shadow-sm">
                {name}
              </span>
              {i < CHAIN.length - 1 && <span className="text-amber-700">→</span>}
            </span>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-bold">{t('home.historyTitle')}</h2>
        <p className="mt-4 text-stone-700 leading-relaxed whitespace-pre-line">{history}</p>
      </section>
    </div>
  )
}
