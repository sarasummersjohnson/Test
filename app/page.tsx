'use client'

import { useEffect, useState } from 'react'
import LoginForm from '@/components/LoginForm'
import CaptionForm, { type CaptionResult } from '@/components/CaptionForm'
import CaptionResults from '@/components/CaptionResults'
import CalendarForm from '@/components/CalendarForm'
import CalendarResults, { type CalendarPost } from '@/components/CalendarResults'

type Mode = 'single' | 'calendar'

export default function Home() {
  const [checked, setChecked] = useState(false)
  const [accessCode, setAccessCode] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [mode, setMode] = useState<Mode>('single')

  const [results, setResults] = useState<CaptionResult[]>([])
  const [calendarOrgName, setCalendarOrgName] = useState('')
  const [calendarPosts, setCalendarPosts] = useState<CalendarPost[]>([])

  useEffect(() => {
    const storedCode = sessionStorage.getItem('accessCode')
    const storedLabel = sessionStorage.getItem('accessLabel') || ''
    if (storedCode) {
      setAccessCode(storedCode)
      setLabel(storedLabel)
    }
    setChecked(true)
  }, [])

  function handleLoginSuccess(code: string, lbl: string) {
    sessionStorage.setItem('accessCode', code)
    sessionStorage.setItem('accessLabel', lbl)
    setAccessCode(code)
    setLabel(lbl)
  }

  function handleLogout() {
    sessionStorage.removeItem('accessCode')
    sessionStorage.removeItem('accessLabel')
    setAccessCode(null)
    setResults([])
    setCalendarPosts([])
  }

  // Avoid a login-screen flash while sessionStorage is checked on mount.
  if (!checked) return null

  if (!accessCode) {
    return <LoginForm onSuccess={handleLoginSuccess} />
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Caption Generator</h1>
        <div>
          {label && <span>{label}</span>}
          <button onClick={handleLogout} className="link-button">
            Log out
          </button>
        </div>
      </header>

      <div className="mode-toggle">
        <button
          type="button"
          className={mode === 'single' ? 'mode-tab active' : 'mode-tab'}
          onClick={() => setMode('single')}
        >
          Single batch
        </button>
        <button
          type="button"
          className={mode === 'calendar' ? 'mode-tab active' : 'mode-tab'}
          onClick={() => setMode('calendar')}
        >
          Posting calendar
        </button>
      </div>

      {mode === 'single' ? (
        <>
          <CaptionForm accessCode={accessCode} onResults={setResults} />
          <CaptionResults results={results} />
        </>
      ) : (
        <>
          <CalendarForm
            accessCode={accessCode}
            onResults={(org, posts) => {
              setCalendarOrgName(org)
              setCalendarPosts(posts)
            }}
          />
          <CalendarResults accessCode={accessCode} orgName={calendarOrgName} posts={calendarPosts} />
        </>
      )}
    </main>
  )
}
