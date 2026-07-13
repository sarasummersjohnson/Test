'use client'

import { useState } from 'react'

export type CalendarPost = {
  index: number
  date: string
  pillarKey: string
  pillarLabel: string
  category: 'membership' | 'donor'
  caption: string
}

type Props = {
  accessCode: string
  orgName: string
  posts: CalendarPost[]
}

export default function CalendarResults({ accessCode, orgName, posts }: Props) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!posts.length) return null

  async function handleDownload() {
    setError(null)
    setDownloading(true)
    try {
      const res = await fetch('/api/generate-calendar/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode, orgName, posts }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Could not build the Excel file.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'posting-calendar.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Could not build the Excel file.')
    } finally {
      setDownloading(false)
    }
  }

  const missingCount = posts.filter((p) => !p.caption.trim()).length

  return (
    <div className="results">
      <div className="calendar-toolbar">
        <button onClick={handleDownload} disabled={downloading}>
          {downloading ? 'Preparing file…' : 'Download as Excel'}
        </button>
        {missingCount > 0 && (
          <p className="error">
            {missingCount} of {posts.length} posts came back without a caption — you may want to
            regenerate.
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="calendar-table-wrap">
        <table className="calendar-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Pillar</th>
              <th>Category</th>
              <th>Caption</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.index}>
                <td>{post.date}</td>
                <td>{post.pillarLabel}</td>
                <td>{post.category === 'membership' ? 'Membership' : 'Donor'}</td>
                <td>{post.caption || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
