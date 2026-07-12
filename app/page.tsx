'use client'

import { useEffect, useState } from 'react'
import LoginForm from '@/components/LoginForm'
import CaptionForm, { type CaptionResult } from '@/components/CaptionForm'
import CaptionResults from '@/components/CaptionResults'

export default function Home() {
  const [checked, setChecked] = useState(false)
  const [accessCode, setAccessCode] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [results, setResults] = useState<CaptionResult[]>([])

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
      <CaptionForm accessCode={accessCode} onResults={setResults} />
      <CaptionResults results={results} />
    </main>
  )
}
