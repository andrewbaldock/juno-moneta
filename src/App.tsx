import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Accounts from './screens/Accounts'
import CashFlows from './screens/CashFlows'
import Dashboard from './screens/Dashboard'
import Tasks from './screens/Tasks'
import Estate from './screens/Estate'
import Help from './screens/Help'
import { useAdvisor, ConvoRail, ConvoThread } from './screens/Advisor'
import JunoPresence from './components/juno/JunoPresence'
import { UpdateToast } from './components/UpdateToast'
import { HealthToast } from './components/HealthToast'
import { COIN_SRC, Moon, Sun } from './components/juno/motifs'
import { annualReviewTask, checklistTasks, loadDone } from './lib/tasks'
import { firstName, juno, peopleList, type HouseholdSettings } from './copy/juno'
import { APP_NAME } from './brand'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)

  // theme is app-wide, applied before either screen renders
  useEffect(() => {
    if (localStorage.getItem('juno.mode') === 'dark') document.documentElement.setAttribute('data-mode', 'dark')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (session && recovery) return <RecoverPassword onDone={() => setRecovery(false)} />
  return (
    <>
      {session ? <Home session={session} /> : <Login />}
      <UpdateToast />
      <HealthToast signedIn={!!session} />
    </>
  )
}

/** Shared new-password form — used by the email-recovery screen and the in-app dialog. */
function PasswordForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('At least 8 characters.'); return }
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) { setError(error.message); return }
    onDone()
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <input type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (8+ characters)" autoComplete="new-password" className="field" />
      {error && <p className="text-sm text-down">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="btn-mint flex-1 disabled:opacity-50">
          {busy ? 'Saving…' : 'Set new password'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-quiet">Cancel</button>}
      </div>
    </form>
  )
}

function RecoverPassword({ onDone }: { onDone: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-line rounded-[18px] p-8 space-y-4 text-center"
        style={{ boxShadow: '0 1px 2px rgba(60,44,16,.05), 0 10px 30px rgba(60,44,16,.06)' }}>
        <img src={COIN_SRC} alt={APP_NAME} className="w-24 mx-auto" />
        <p className="voice text-[15px]">Let’s set a fresh password and get you back in.</p>
        <PasswordForm onDone={onDone} />
      </div>
    </main>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  async function forgot() {
    setError(null)
    setNotice(null)
    if (!email.trim()) { setError('Enter your email above first.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    if (error) { setError(error.message); return }
    setNotice('Check your email — the link brings you back here to set a new one.')
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={signIn}
        className="w-full max-w-sm bg-card border border-line rounded-[18px] p-8 space-y-4 text-center"
        style={{ boxShadow: '0 1px 2px rgba(60,44,16,.05), 0 10px 30px rgba(60,44,16,.06)' }}>
        <img src={COIN_SRC} alt={APP_NAME} className="w-32 mx-auto" />
        <div className="bn" style={{ '--bns': '26px', marginBottom: 18 } as React.CSSProperties}>J<span className="u">UNO</span></div>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" className="field" />
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" className="field" />
        {error && <p className="text-sm text-down">{error}</p>}
        {notice && <p className="voice italic text-[13.5px] text-gold-ink">{notice}</p>}
        <button type="submit" disabled={busy} className="btn-mint w-full disabled:opacity-50">
          {busy ? juno.signingIn : juno.signIn}
        </button>
        <button type="button" onClick={forgot}
          className="text-xs text-faint hover:text-muted bg-transparent border-0 cursor-pointer p-0">
          Forgot password?
        </button>
      </form>
    </main>
  )
}

const TABS = [
  ['dashboard', 'Dashboard'],
  ['tasks', 'Tasks'],
  ['monthly', 'Monthly in & out'],
  ['accounts', 'Accounts & Debts'],
  ['estate', 'Estate'],
] as const
type TabId = (typeof TABS)[number][0]

// URL is the source of truth: dashboard lives at the home address, everything else has a path
const TAB_PATHS: Record<TabId, string> = { dashboard: '/', accounts: '/assets', monthly: '/payments', tasks: '/tasks', estate: '/estate' }
const HELP_PATH = '/help'
const pathToTab = (p: string): TabId =>
  ((Object.entries(TAB_PATHS).find(([, path]) => path === p)?.[0] as TabId) ?? 'dashboard')

const LIM = { 1: [210, 420], 2: [300, 620] } as const
const DEFAULTS = { 1: 268, 2: 392 } as const

function Home({ session }: { session: Session }) {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [shelfCents, setShelfCents] = useState(0)
  const [settings, setSettings] = useState<HouseholdSettings>({})
  const [tab, setTabState] = useState<TabId>(() => pathToTab(location.pathname))
  const [showHelp, setShowHelp] = useState(() => location.pathname === HELP_PATH)
  const [mobile, setMobile] = useState<'c1' | 'c2' | 'c3'>('c2')
  const userName = firstName(session.user.email, settings.people)

  function setTab(t: TabId) {
    history.pushState(null, '', TAB_PATHS[t])
    setShowHelp(false)
    setTabState(t)
  }
  function openHelp() {
    history.pushState(null, '', HELP_PATH)
    setShowHelp(true)
  }
  function closeHelp() {
    history.pushState(null, '', TAB_PATHS[tab])
    setShowHelp(false)
  }
  useEffect(() => {
    const onPop = () => {
      setShowHelp(location.pathname === HELP_PATH)
      setTabState(pathToTab(location.pathname))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // shell geometry — juno.w1/w2 widths, juno.c1/c2 collapse, all persisted (03-layout.md)
  const [w1, setW1] = useState(() => Number(localStorage.getItem('juno.w1')) || DEFAULTS[1])
  const [w2, setW2] = useState(() => Number(localStorage.getItem('juno.w2')) || DEFAULTS[2])
  const [col1, setCol1] = useState(() => localStorage.getItem('juno.c1') === '1')
  const [col2, setCol2] = useState(() => localStorage.getItem('juno.c2') === '1')
  const [dark, setDark] = useState(() => localStorage.getItem('juno.mode') === 'dark')
  const autoed = useRef(false)

  useEffect(() => { localStorage.setItem('juno.w1', String(w1)) }, [w1])
  useEffect(() => { localStorage.setItem('juno.w2', String(w2)) }, [w2])
  useEffect(() => { localStorage.setItem('juno.c1', col1 ? '1' : '0') }, [col1])
  useEffect(() => { localStorage.setItem('juno.c2', col2 ? '1' : '0') }, [col2])
  useEffect(() => {
    document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light')
    localStorage.setItem('juno.mode', dark ? 'dark' : 'light')
  }, [dark])

  // auto-collapse column 1 when the viewport is tight, restore when there's room (03-layout.md)
  useEffect(() => {
    function fit() {
      if (window.innerWidth <= 900) return
      const tight = window.innerWidth < 1080
      if (tight && !col1) { autoed.current = true; setCol1(true) }
      else if (!tight && autoed.current && col1) { autoed.current = false; setCol1(false) }
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [col1])

  function startDrag(which: 1 | 2) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const rz = e.currentTarget
      rz.setPointerCapture(e.pointerId)
      rz.classList.add('on')
      const [MIN, MAX] = LIM[which]
      const startX = e.clientX
      const startW = which === 1 ? w1 : w2
      const setW = which === 1 ? setW1 : setW2
      const move = (ev: PointerEvent) => setW(Math.max(MIN, Math.min(MAX, Math.round(startW + ev.clientX - startX))))
      const up = () => {
        rz.classList.remove('on')
        rz.removeEventListener('pointermove', move)
        rz.removeEventListener('pointerup', up)
      }
      rz.addEventListener('pointermove', move)
      rz.addEventListener('pointerup', up)
    }
  }

  useEffect(() => {
    supabase.from('households').select('id,shelf_cents,settings').limit(1).single()
      .then(({ data }) => {
        setHouseholdId(data?.id ?? null)
        setShelfCents(data?.shelf_cents ?? 0)
        setSettings((data?.settings as HouseholdSettings) ?? {})
      })
  }, [])

  function scrollToCol(id: 'c1' | 'c2' | 'c3') {
    setMobile(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (householdId === null) {
    return <main className="min-h-screen grid place-items-center"><p className="text-faint">Loading household…</p></main>
  }

  return <Shell {...{ householdId, shelfCents, setShelfCents, tab, setTab, showHelp, openHelp, closeHelp, mobile, scrollToCol, w1, w2, setW1, setW2, col1, col2, setCol1, setCol2, dark, setDark, startDrag, userName, overlay: settings.advisor_overlay ?? '', people: peopleList(settings.people) }} />
}

/** The name pill: who she's speaking to, and the small self-serve menu behind it. */
function WhoMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <span style={{ position: 'relative' }}>
      <button type="button" className="whopill" title={`${APP_NAME} speaks to whoever is here`}
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}>
        {userName}
      </button>
      {open && (
        <div className="rowmenu" style={{ right: 0, top: 34 }} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { setOpen(false); setPwOpen(true) }}>Change password</button>
          <button type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      )}
      {pwOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center" style={{ background: 'rgba(20,16,9,.35)' }}
          onClick={() => setPwOpen(false)}>
          <div className="w-full max-w-sm bg-card border border-line rounded-2xl p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-[19px]">Change password</h3>
            <PasswordForm onDone={() => setPwOpen(false)} onCancel={() => setPwOpen(false)} />
          </div>
        </div>
      )}
    </span>
  )
}

function Shell({
  householdId, shelfCents, setShelfCents, tab, setTab, showHelp, openHelp, closeHelp, mobile, scrollToCol, w1, w2, setW1, setW2,
  col1, col2, setCol1, setCol2, dark, setDark, startDrag, userName, overlay, people,
}: {
  householdId: string
  shelfCents: number
  overlay: string
  people: string[]
  setShelfCents: (n: number) => void
  tab: TabId
  setTab: (t: TabId) => void
  showHelp: boolean
  openHelp: () => void
  closeHelp: () => void
  mobile: 'c1' | 'c2' | 'c3'
  scrollToCol: (id: 'c1' | 'c2' | 'c3') => void
  w1: number; w2: number
  setW1: (n: number) => void; setW2: (n: number) => void
  col1: boolean; col2: boolean
  setCol1: (b: boolean) => void; setCol2: (b: boolean) => void
  dark: boolean; setDark: (b: boolean) => void
  startDrag: (which: 1 | 2) => (e: React.PointerEvent<HTMLDivElement>) => void
  userName: string
}) {
  const adv = useAdvisor(householdId, shelfCents, overlay)

  // the tab's quiet nudge: unknown numbers or unanswered checklist questions exist
  const hasOpenTasks = useMemo(() => {
    if (!adv.ready) return false
    const done = loadDone()
    return adv.gaps.length > 0
      || checklistTasks(adv.accounts, adv.flows).some((t) => !done.has(t.key))
      || annualReviewTask().some((t) => !done.has(t.key))
  }, [adv.ready, adv.accounts, adv.flows, adv.gaps])

  // Juno scales with her room: interpolate coin/wordmark/padding against column width (02-components.md)
  const t = Math.max(0, Math.min(1, (w1 - 210) / (420 - 210)))
  const presenceVars = {
    '--w1': `${w1}px`,
    // coin sized so coin + wordmark + date + garden stay within a 160px band
    '--cs': `${Math.round(72 + t * 10)}px`,
    '--pp': `${Math.round(12 + t * 6)}px`,
    '--bns': `${(18 + t * 4).toFixed(1)}px`,
  } as React.CSSProperties

  const anyCollapsed = col1 || col2

  return (
    <>
      <div className="mobbar">
        {(['c1', 'c2', 'c3'] as const).map((id) => (
          <button key={id} type="button" className={mobile === id ? 'on' : ''} onClick={() => scrollToCol(id)}>
            {id === 'c1' ? 'Conversations' : id === 'c2' ? APP_NAME : 'Workspace'}
          </button>
        ))}
      </div>

      <div className="app">
        {/* COL 1 · past conversations */}
        <aside id="c1" className={`col c1 ${col1 ? 'collapsed' : ''}`} style={presenceVars}>
          <JunoPresence />
          <ConvoRail adv={adv} />
          <div className="rz" onPointerDown={startDrag(1)} onDoubleClick={() => setW1(DEFAULTS[1])} />
          <button type="button" className="grip" aria-label={col1 ? 'Show conversations' : 'Hide conversations'}
            onClick={() => setCol1(!col1)}>
            {col1 ? '›' : '‹'}
          </button>
        </aside>

        {/* COL 2 · current conversation */}
        <section id="c2" className={`col c2 ${col2 ? 'collapsed' : ''}`} style={{ ...presenceVars, '--w2': `${w2}px` } as React.CSSProperties}>
          <ConvoThread adv={adv} userName={userName} showPresence={col1 && !col2} />
          <div className="rz" onPointerDown={startDrag(2)} onDoubleClick={() => setW2(DEFAULTS[2])} />
          <button type="button" className="grip" aria-label={col2 ? 'Show Juno' : 'Hide Juno'}
            onClick={() => setCol2(!col2)}>
            {col2 ? '›' : '‹'}
          </button>
        </section>

        {/* COL 3 · workspace */}
        <section id="c3" className="col c3">
          <div className="tabbar">
            {anyCollapsed && (
              <button type="button" className="showbtn" onClick={() => { setCol1(false); setCol2(false) }}>
                Show {APP_NAME}
              </button>
            )}
            {TABS.map(([id, label]) => (
              <button key={id} type="button" className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
                {label}
                {id === 'tasks' && hasOpenTasks && <span className="taskdot" aria-label="unfinished tasks" />}
              </button>
            ))}
            <span className="sp" />
            <WhoMenu userName={userName} />
            <button type="button" className="modebtn" aria-label="How Juno works" title="How Juno works"
              onClick={openHelp}>
              ?
            </button>
            <button type="button" className="modebtn modeicon" aria-label={dark ? 'Switch to day' : 'Switch to night'}
              title={dark ? 'Switch to day' : 'Switch to night'} onClick={() => setDark(!dark)}>
              {dark ? <Moon /> : <Sun />}
            </button>
          </div>

          <div className="view">
            {tab === 'dashboard' ? (
              <Dashboard householdId={householdId} shelfCents={shelfCents} setShelfCents={setShelfCents} />
            ) : tab === 'accounts' ? (
              <Accounts householdId={householdId} />
            ) : tab === 'monthly' ? (
              <CashFlows householdId={householdId} />
            ) : tab === 'estate' ? (
              <Estate householdId={householdId} people={people} />
            ) : (
              <Tasks goTo={setTab} />
            )}
          </div>
        </section>
      </div>
      {showHelp && <Help onClose={closeHelp} />}
    </>
  )
}
