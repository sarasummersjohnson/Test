'use client'

import { useState, type FormEvent } from 'react'
import type { CalendarPost } from './CalendarResults'

const MIN_POSTS_PER_WEEK = 1
const MAX_POSTS_PER_WEEK = 5
const DEFAULT_POSTS_PER_WEEK = 2
const DEFAULT_WEEKS = 4
const MIN_WEEKS = 1
const MAX_WEEKS = 13 // a fiscal quarter: 52-week year / 4
const MAX_EVENTS = 12

type EventRow = {
  id: number
  name: string
  date: string
  hasSponsors: boolean
}

type Props = {
  accessCode: string
  onResults: (orgName: string, posts: CalendarPost[]) => void
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

let nextEventRowId = 1

export default function CalendarForm({ accessCode, onResults }: Props) {
  const [orgName, setOrgName] = useState('')
  const [missionStatement, setMissionStatement] = useState('')
  const [event, setEvent] = useState('')
  const [toneNote, setToneNote] = useState('')
  const [keyFacts, setKeyFacts] = useState('')
  const [startDate, setStartDate] = useState(todayISO())

  const [weeks, setWeeks] = useState<number>(DEFAULT_WEEKS)
  const [weeksWarning, setWeeksWarning] = useState<string | null>(null)

  const [postsPerWeek, setPostsPerWeek] = useState<number>(DEFAULT_POSTS_PER_WEEK)
  const [postsPerWeekWarning, setPostsPerWeekWarning] = useState<string | null>(null)

  const [events, setEvents] = useState<EventRow[]>([])

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

  function addEventRow() {
    if (events.length >= MAX_EVENTS) return
    setEvents((prev) => [...prev, { id: nextEventRowId++, name: '', date: startDate, hasSponsors: false }])
  }
  function removeEventRow(id: number) {
    setEvents((prev) => prev.filter((row) => row.id !== id))
  }
  function updateEventRow(id: number, patch: Partial<Omit<EventRow, 'id'>>) {
    setEvents((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
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
    const namedEvents = events.filter((row) => row.name.trim())
    for (const row of namedEvents) {
      if (!row.date) {
        setError(`Event "${row.name.trim()}" needs a date.`)
        return
      }
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
          keyFacts: keyFacts.trim(),
          startDate,
          weeks: safeWeeks,
          postsPerWeek: safePostsPerWeek,
          events: namedEvents.map((row) => ({
            name: row.name.trim(),
            date: row.date,
            hasSponsors: row.hasSponsors,
          })),
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
        Upcoming event or campaign (general context)
        <textarea
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          rows={2}
          placeholder="Optional — loose context for tone/flavor. For posts scheduled around a real event date, use the Events section below instead."
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
        Details to include
        <textarea
          value={keyFacts}
          onChange={(e) => setKeyFacts(e.target.value)}
          rows={4}
          placeholder="Optional — real names, quotes, or numbers to work into the captions across the calendar (e.g. from a client intake survey). Only what you enter here gets used; nothing gets invented."
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

      <fieldset>
        <legend>Events (optional)</legend>
        <p className="field-hint">
          Each event gets its own Pre-Event / Event / Post-Event arc built around its real date.
          Weeks with no events fall back to steady-state content. Must fall within the start
          date / weeks range above.
        </p>
        {events.map((row) => (
          <div key={row.id} className="event-row">
            <input
              value={row.name}
              onChange={(e) => updateEventRow(row.id, { name: e.target.value })}
              placeholder="Event name"
              className="event-row-name"
            />
            <input
              type="date"
              value={row.date}
              onChange={(e) => updateEventRow(row.id, { date: e.target.value })}
            />
            <label className="checkbox event-row-sponsors">
              <input
                type="checkbox"
                checked={row.hasSponsors}
                onChange={(e) => updateEventRow(row.id, { hasSponsors: e.target.checked })}
              />
              Has sponsors
            </label>
            <button
              type="button"
              className="link-button"
              onClick={() => removeEventRow(row.id)}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addEventRow} disabled={events.length >= MAX_EVENTS}>
          + Add event
        </button>
      </fieldset>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? 'Generating calendar…' : 'Generate calendar'}
      </button>
    </form>
  )
}
