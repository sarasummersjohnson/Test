'use client'

import { useState, type FormEvent } from 'react'
import { MEMBERSHIP_PILLARS_PUBLIC, DONOR_PILLARS_PUBLIC } from '@/lib/pillarsPublic'

export type CaptionResult = { pillar: string; caption: string }

type ContentType = 'Membership' | 'Donor' | 'Combined'

const CONTENT_TYPES: ContentType[] = ['Membership', 'Donor', 'Combined']

type Props = {
  accessCode: string
  onResults: (results: CaptionResult[]) => void
}

export default function CaptionForm({ accessCode, onResults }: Props) {
  const [orgName, setOrgName] = useState('')
  const [contentType, setContentType] = useState<ContentType>('Membership')
  const [missionStatement, setMissionStatement] = useState('')
  const [event, setEvent] = useState('')
  const [toneNote, setToneNote] = useState('')
  const [selectedPillars, setSelectedPillars] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function togglePillar(key: string) {
    setSelectedPillars((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  function handleContentTypeChange(value: ContentType) {
    setContentType(value)
    if (value !== 'Combined') setSelectedPillars([])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!orgName.trim()) {
      setError('Organization name is required.')
      return
    }
    if (contentType === 'Combined' && selectedPillars.length === 0) {
      setError('Select at least one pillar for combined content.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessCode,
          orgName: orgName.trim(),
          contentType,
          missionStatement: missionStatement.trim(),
          event: event.trim(),
          toneNote: toneNote.trim(),
          pillars: contentType === 'Combined' ? selectedPillars : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }
      onResults(data.captions as CaptionResult[])
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
        Content type
        <select
          value={contentType}
          onChange={(e) => handleContentTypeChange(e.target.value as ContentType)}
        >
          {CONTENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
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

      {contentType === 'Combined' && (
        <fieldset>
          <legend>Pillars to include</legend>
          <div className="pillar-group">
            <p>Membership</p>
            {MEMBERSHIP_PILLARS_PUBLIC.map((pillar) => (
              <label key={pillar.key} className="checkbox">
                <input
                  type="checkbox"
                  checked={selectedPillars.includes(pillar.key)}
                  onChange={() => togglePillar(pillar.key)}
                />
                {pillar.label}
              </label>
            ))}
          </div>
          <div className="pillar-group">
            <p>Donor</p>
            {DONOR_PILLARS_PUBLIC.map((pillar) => (
              <label key={pillar.key} className="checkbox">
                <input
                  type="checkbox"
                  checked={selectedPillars.includes(pillar.key)}
                  onChange={() => togglePillar(pillar.key)}
                />
                {pillar.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? 'Generating…' : 'Generate'}
      </button>
    </form>
  )
}
