'use client'

import { useState, type FormEvent } from 'react'

type Props = {
  onSuccess: (accessCode: string, label: string) => void
}

export default function LoginForm({ onSuccess }: Props) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: code }),
      })
      const data = await res.json()
      if (!res.ok || !data.valid) {
        setError(data.error || 'Invalid access code.')
        return
      }
      if (data.isAdmin) {
        sessionStorage.setItem('adminCode', code.trim())
        window.location.href = '/admin'
        return
      }
      onSuccess(code.trim(), data.label || '')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <form onSubmit={handleSubmit} className="login-form">
        <h1>Caption Generator</h1>
        <p>Enter your access code to continue.</p>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading || !code.trim()}>
          {loading ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
