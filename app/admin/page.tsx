'use client'

import { useEffect, useState } from 'react'

type UsageRow = { code: string; label: string; count: number }

export default function AdminPage() {
  const [code, setCode] = useState('')
  const [usage, setUsage] = useState<UsageRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchUsage(accessCode: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid admin code.')
        sessionStorage.removeItem('adminCode')
        return
      }
      sessionStorage.setItem('adminCode', accessCode)
      setUsage(data.usage)
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const stored = sessionStorage.getItem('adminCode')
    if (stored) {
      setCode(stored)
      fetchUsage(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleLogout() {
    sessionStorage.removeItem('adminCode')
    setUsage(null)
    setCode('')
  }

  if (usage) {
    return (
      <main className="app admin">
        <header className="app-header">
          <h1>Usage — Admin</h1>
          <button className="link-button" onClick={handleLogout}>
            Log out
          </button>
        </header>
        <table>
          <thead>
            <tr>
              <th>Access code</th>
              <th>Label</th>
              <th>Times used</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((row) => (
              <tr key={row.code}>
                <td>{row.code}</td>
                <td>{row.label}</td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => fetchUsage(code)} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </main>
    )
  }

  return (
    <div className="login-screen">
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault()
          fetchUsage(code)
        }}
      >
        <h1>Admin</h1>
        <p>Enter the admin access code.</p>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Admin code"
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading || !code.trim()}>
          {loading ? 'Checking…' : 'View usage'}
        </button>
      </form>
    </div>
  )
}
