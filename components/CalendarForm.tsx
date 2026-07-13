'use client'

import { useState, type FormEvent } from 'react'
import type { CalendarPost } from './CalendarResults'

const MIN_POSTS_PER_WEEK = 1
const MAX_POSTS_PER_WEEK = 5
const DEFAULT_POSTS_PER_WEEK = 2
const DEFAULT_WEEKS = 4
const MIN_WEEKS = 1
const MAX_WEEKS = 13 // a fiscal quarter: 52-week year / 4

type Props = {
  accessCode: string
  onResults: (orgName: string, posts: CalendarPost[]) => void
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function CalendarForm({ accessCode, onResults }: Props) {
  const [orgName, setOrgName] = useState('')
  const [missionStatement, setMissionStatement] = useState('')
  const [event, setEvent] = useState('')
  const [toneNote, setToneNote] = useState('')
  const [startDate, setStartDate] = useState(todayISO())

  const [weeks, setWeeks] = useState<number>(DEFAULT_WEEKS)
  const [weeksWarning, setWeeksWarning] = useState<string | null>(null)

  const [postsPerWeek, setPostsPerWeek] = useState<number>(DEFAULT_POSTS_PER_WEEK)
  const [postsPerWeekWarning, setPostsPerWeekWarning] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Clamps to [min, max] immediately on every keystroke, so an out-of-range
  // value can never reach the generation logic, and surfaces a message when
  // a clamp actually happened.
  function makeClampHandler(
    min: number,
    max: number,
    setValue: (n: number) => void,
    setWarning: (msg: string | null) => void,
    fieldName: string,
  ) {
    return (raw: string) => {
      if (raw === '') {
        setValue(NaN)
        setWarning(null)
        return
      }
      const parsed = Math.round(Number(raw))
      if (!Number.isFinite(parsed)) return
      if (parsed < min || parsed > max) {
        const clamped = Math.min(max, Math.max(min, parsed))
        setValue(clamped)
        setWarning(`${fieldName} must be between ${min} and ${max} — adjusted to ${clamped}.`)
      } else {
        setValue(parsed)
        setWarning(null)
      }
    }
  }

  const handleWeeksChange = makeClampHandler(MIN_WEEKS, MAX_WEEKS, setWeeks, setWeeksWarning, 'Number of weeks')
  const handlePostsPerWeekChange = makeClampHandler(
    MIN_POSTS_PER_WEEK,
    MAX_POSTS_PER_WEEK,
    setPostsPerWeek,
    setPostsPerWeekWarning,
    'Posts per week',
  )

  function handleWeeksBlur() {
    if (Number.isNaN(weeks)) setWeeks(DEFAULT_WEEKS)
  }
  function handlePostsPerWeekBlur() {
    if (Number.isNaN(postsPerWeek)) setPostsPerWeek(DEFAULT_POSTS_PER_WEEK)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!orgName.trim()) {
      setError('Organization name is required.')
      return
    }
    if (!startDate) {
      setError('Start date is required.')
      return
    }

    const safeWeeks = Number.isNaN(weeks) ? DEFAULT_WEEKS : weeks
    const safePostsPerWeek = Number.isNaN(postsPerWeek) ? DEFAULT_POSTS_PER_WEEK : postsPerWeek

    setLoading(true)
    try {
      const res = await fetch('/api/generate-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessCode,
          orgName: orgName.trim(),
          missionStatement: missionStatement.trim(),
          event: event.trim(),
          toneNote: toneNote.trim(),
          startDate,
          weeks: safeWeeks,
          postsPerWeek: safePostsPerWeek,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }
      onResults(orgName.trim(), data.posts as CalendarPost[])
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="caption-form">
      <label>
        Organization name
        <input value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
      </label>

      <label>
        Mission statement
        <textarea
          value={missionStatement}
          onChange={(e) => setMissionStatement(e.target.value)}
          rows={2}
          placeholder="Optional — a short mission statement"
        />
      </label>

      <label>
        Upcoming event or campaign
        <textarea
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          rows={2}
          placeholder="Optional"
        />
      </label>

      <label>
        Tone note
        <input
          value={toneNote}
          onChange={(e) => setToneNote(e.target.value)}
          placeholder="Optional — e.g. playful, formal, urgent"
        />
      </label>

      <label>
        Start date
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
      </label>

      <label>
        Number of weeks
        <input
          type="number"
          min={MIN_WEEKS}
          max={MAX_WEEKS}
          value={Number.isNaN(weeks) ? '' : weeks}
          onChange={(e) => handleWeeksChange(e.target.value)}
          onBlur={handleWeeksBlur}
        />
        {weeksWarning && <span className="field-warning">{weeksWarning}</span>}
      </label>

      <label>
        Posts per week
        <input
          type="number"
          min={MIN_POSTS_PER_WEEK}
          max={MAX_POSTS_PER_WEEK}
          value={Number.isNaN(postsPerWeek) ? '' : postsPerWeek}
          onChange={(e) => handlePostsPerWeekChange(e.target.value)}
          onBlur={handlePostsPerWeekBlur}
        />
        {postsPerWeekWarning && <span className="field-warning">{postsPerWeekWarning}</span>}
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? 'Generating calendar…' : 'Generate calendar'}
      </button>
    </form>
  )
}
