import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

export default function Header() {
  const { t, i18n } = useTranslation()
  const { session, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/tree', label: t('nav.tree') },
    ...(session ? [{ to: '/submit', label: t('nav.submit') }] : []),
    ...(profile && profile.role !== 'user' ? [{ to: '/admin', label: t('nav.admin') }] : []),
  ]

  async function logout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `block py-2 md:py-0 hover:text-amber-700 ${isActive ? 'text-amber-700 font-semibold' : ''}`

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link to="/" className="font-bold text-lg whitespace-nowrap">
          Шежіре <span className="text-amber-700">· Манам</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navCls} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-stone-300 overflow-hidden text-xs">
            {(['ru', 'kk'] as const).map((lng) => (
              <button
                key={lng}
                onClick={() => i18n.changeLanguage(lng)}
                className={`px-2 py-1 min-w-11 ${i18n.language === lng ? 'bg-amber-700 text-white' : 'bg-white'}`}
              >
                {lng === 'ru' ? 'РУС' : 'ҚАЗ'}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3 text-sm">
            {session ? (
              <>
                <NavLink to="/profile" className={navCls}>
                  {t('nav.profile')}
                </NavLink>
                <button onClick={logout} className="text-stone-500 hover:text-amber-700">
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navCls}>
                  {t('nav.login')}
                </NavLink>
                <NavLink
                  to="/register"
                  className="bg-amber-700 text-white px-3 py-1.5 rounded-lg hover:bg-amber-800"
                >
                  {t('nav.register')}
                </NavLink>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2 -mr-2"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            <div className="w-5 space-y-1">
              <span className="block h-0.5 bg-slate-900" />
              <span className="block h-0.5 bg-slate-900" />
              <span className="block h-0.5 bg-slate-900" />
            </div>
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t border-stone-200 px-4 py-3 text-sm bg-white" onClick={() => setOpen(false)}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navCls} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
          {session ? (
            <>
              <NavLink to="/profile" className={navCls}>
                {t('nav.profile')}
              </NavLink>
              <button onClick={logout} className="block py-2 text-stone-500">
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navCls}>
                {t('nav.login')}
              </NavLink>
              <NavLink to="/register" className={navCls}>
                {t('nav.register')}
              </NavLink>
            </>
          )}
        </nav>
      )}
    </header>
  )
}
