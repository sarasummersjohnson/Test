// Server-side only. Event-anchored calendar sequencing: builds a 3-phase
// arc (Pre-Event / Event / Post-Event) around each real event date, and
// fills every other week with a Steady-State rotation. Replaces the older
// generic weekly-rotation approach entirely for the Posting Calendar.

import type { Pillar } from './pillars'

export type EventInput = {
  name: string
  date: string // YYYY-MM-DD
  hasSponsors: boolean
}

export type Phase = 'Pre-Event' | 'Event' | 'Post-Event' | 'Steady-State'

export type CalendarSlotSpec = {
  date: string // YYYY-MM-DD
  phase: Phase
  eventName?: string
  /**
   * Usually a single fixed pillar. For the post-event spotlight slot this
   * holds multiple candidates (Member Spotlight / Donor Recognition /
   * Beneficiary Story) — the model picks whichever fits that event's
   * provided details, rather than the engine hardcoding one.
   */
  pillarOptions: Pillar[]
  /** Auto-generated context (which event, timeline compression flags, etc). Still human-editable after export. */
  notes?: string
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function weekIndexForDate(date: Date, calendarStart: Date): number {
  const diffDays = Math.round((date.getTime() - calendarStart.getTime()) / 86_400_000)
  return Math.floor(diffDays / 7)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Cycles through a (possibly weighted, via duplicate entries) key list in shuffled order. */
class PillarQueue {
  private readonly keys: string[]
  private queue: string[] = []

  constructor(keys: string[]) {
    this.keys = keys
  }

  next(): string {
    if (this.queue.length === 0) {
      this.queue = shuffle(this.keys)
    }
    return this.queue.shift()!
  }
}

function requirePillar(pillarByKey: Map<string, Pillar>, key: string): Pillar {
  const pillar = pillarByKey.get(key)
  if (!pillar) throw new Error(`Unknown pillar key: ${key}`)
  return pillar
}

/**
 * Builds the Pre-Event / Event / Post-Event slots for one event, clamped to
 * the calendar's [calendarStart, calendarEndExclusive) window.
 *
 * Sponsorship Recruitment timing: up to 3 touchpoints (90/60/30 days
 * before). Never scheduled less than 30 days before the event — by
 * construction all three ideal offsets already satisfy that. Any touchpoint
 * that would fall before the calendar's start date is dropped (can't
 * publish before the calendar begins) rather than shifted, and a note flags
 * the compressed timeline when that happens.
 */
function buildEventSlots(
  event: EventInput,
  calendarStart: Date,
  calendarEndExclusive: Date,
  pillarByKey: Map<string, Pillar>,
): CalendarSlotSpec[] {
  const slots: CalendarSlotSpec[] = []
  const eventDate = parseDate(event.date)

  // If truly zero sponsorship touchpoints fit (not just "some"), there's no
  // post to attach that note to on its own — pinned here and appended to
  // the next real post generated for this event (Event Promo, or the event
  // day itself if even that's clamped away) rather than silently dropped.
  let unplaceableSponsorshipNote: string | undefined

  // --- Pre-Event: Sponsorship Recruitment (if flagged) ---
  if (event.hasSponsors) {
    const idealOffsetsDays = [90, 60, 30]
    const idealDates = idealOffsetsDays.map((d) => addDays(eventDate, -d))
    const validDates = idealDates.filter((d) => d >= calendarStart)
    const compressed = validDates.length < idealDates.length

    if (validDates.length === 0) {
      unplaceableSponsorshipNote = `No sponsorship recruitment window available for "${event.name}" — event is too close to the calendar's start date for any compliant 30+ day-out ask. Sponsorship outreach for this event needs to happen outside this calendar.`
    } else {
      validDates.forEach((d) => {
        slots.push({
          date: toISODate(d),
          phase: 'Pre-Event',
          eventName: event.name,
          pillarOptions: [requirePillar(pillarByKey, 'sponsor-recruit')],
          notes: compressed
            ? `Sponsorship Recruitment for "${event.name}" — compressed timeline (event is within 90 days of the calendar's start; earlier touchpoint(s) skipped).`
            : `Sponsorship Recruitment for "${event.name}".`,
        })
      })
    }
  }

  // --- Pre-Event: Event Promo (~7 days before, clamped to calendar start) ---
  let promoDate = addDays(eventDate, -7)
  let promoNote = `Event Promo for "${event.name}".`
  if (promoDate < calendarStart) {
    promoDate = calendarStart
    promoNote = `Event Promo for "${event.name}" — clamped to the calendar's start date (event is within 7 days of it).`
  }
  if (unplaceableSponsorshipNote) {
    promoNote = `${promoNote} ${unplaceableSponsorshipNote}`
    unplaceableSponsorshipNote = undefined
  }
  if (promoDate < eventDate) {
    slots.push({
      date: toISODate(promoDate),
      phase: 'Pre-Event',
      eventName: event.name,
      pillarOptions: [requirePillar(pillarByKey, 'event')],
      notes: promoNote,
    })
  }

  // --- Event day: real-time/presence content ---
  if (eventDate >= calendarStart && eventDate < calendarEndExclusive) {
    let eventDayNote = `Day-of, real-time/presence content for "${event.name}" — not a promotional announcement, write as if posting live from the event.`
    if (unplaceableSponsorshipNote) {
      eventDayNote = `${eventDayNote} ${unplaceableSponsorshipNote}`
      unplaceableSponsorshipNote = undefined
    }
    slots.push({
      date: toISODate(eventDate),
      phase: 'Event',
      eventName: event.name,
      pillarOptions: [requirePillar(pillarByKey, 'event')],
      notes: eventDayNote,
    })
  }

  // Last resort: if even the event-day post didn't fit (event date itself
  // is somehow outside the calendar span — the API route validates against
  // this, but stay defensive), attach to the first remaining slot for this
  // event, or surface a slot solely to carry the flag.
  if (unplaceableSponsorshipNote && slots.length > 0) {
    slots[0].notes = slots[0].notes
      ? `${slots[0].notes} ${unplaceableSponsorshipNote}`
      : unplaceableSponsorshipNote
    unplaceableSponsorshipNote = undefined
  }

  // --- Post-Event: Sponsor Thank-You (~1-2 days after, if flagged) ---
  if (event.hasSponsors) {
    const thanksDate = addDays(eventDate, 1)
    if (thanksDate < calendarEndExclusive) {
      slots.push({
        date: toISODate(thanksDate),
        phase: 'Post-Event',
        eventName: event.name,
        pillarOptions: [requirePillar(pillarByKey, 'sponsor-thanks')],
        notes: `Sponsor Thank-You for "${event.name}" — name and tag confirmed sponsors.`,
      })
    }
  }

  // --- Post-Event: Spotlight/testimonial (~5-7 days after) ---
  const spotlightDate = addDays(eventDate, 6)
  if (spotlightDate < calendarEndExclusive) {
    slots.push({
      date: toISODate(spotlightDate),
      phase: 'Post-Event',
      eventName: event.name,
      pillarOptions: [
        requirePillar(pillarByKey, 'spotlight'),
        requirePillar(pillarByKey, 'recognition'),
        requirePillar(pillarByKey, 'beneficiary'),
      ],
      notes: `Post-event spotlight/testimonial for "${event.name}" — choose whichever of the three candidate pillars best fits this event's provided details.`,
    })
  }

  return slots.filter((slot) => slot.pillarOptions.length > 0)
}

/**
 * Steady-state floor for weeks with no event activity: rotates
 * Myth-Busting / [Community Impact, weighted 2:1, Impact Proof] / The Ask.
 *
 * Note on the ratio: Myth-Busting (membership) and The Ask (donor) are
 * fixed in this 3-slot cycle, which is 1:1 on its own — so an exactly even
 * 50/50 alternation in the third slot caps the whole rotation at 1:1, and
 * an exact 2:1 would require the third slot to be Community Impact 100% of
 * the time (Impact Proof never appearing). Since both matter here, this
 * weights the third slot 2:1 toward Community Impact rather than a flat
 * split — leans membership-heavy without freezing Impact Proof out
 * entirely. The fixed 3-slot pattern also means no extra anti-repeat logic
 * is needed: the weighted queue's own consecutive picks are never adjacent
 * posts (they're always separated by a Myth-Busting and a The Ask).
 */
function generateSteadyStateSlots(
  calendarStart: Date,
  weeks: number,
  postsPerWeek: number,
  eventWeeks: Set<number>,
  pillarByKey: Map<string, Pillar>,
): CalendarSlotSpec[] {
  const slots: CalendarSlotSpec[] = []
  const impactOrProofQueue = new PillarQueue(['impact', 'impact', 'proof'])

  let cycleIndex = 0
  for (let week = 0; week < weeks; week++) {
    if (eventWeeks.has(week)) continue // event content owns this week entirely

    for (let postInWeek = 0; postInWeek < postsPerWeek; postInWeek++) {
      const dayOffset = Math.floor((postInWeek * 7) / postsPerWeek)
      const date = toISODate(addDays(calendarStart, week * 7 + dayOffset))

      const slotInCycle = cycleIndex % 3
      const key = slotInCycle === 0 ? 'myth' : slotInCycle === 2 ? 'ask' : impactOrProofQueue.next()

      slots.push({ date, phase: 'Steady-State', pillarOptions: [requirePillar(pillarByKey, key)] })
      cycleIndex++
    }
  }

  return slots
}

/**
 * Full event-anchored calendar: event arcs placed by their real dates, all
 * other weeks filled by the steady-state floor. Result is sorted
 * chronologically; caller assigns final `index`.
 */
export function generateEventAnchoredCalendar(
  startDate: string,
  weeks: number,
  postsPerWeek: number,
  events: EventInput[],
  pillarByKey: Map<string, Pillar>,
): CalendarSlotSpec[] {
  const calendarStart = parseDate(startDate)
  const calendarEndExclusive = addDays(calendarStart, weeks * 7)

  const eventSlots: CalendarSlotSpec[] = []
  for (const event of events) {
    eventSlots.push(...buildEventSlots(event, calendarStart, calendarEndExclusive, pillarByKey))
  }

  const eventWeeks = new Set<number>()
  for (const slot of eventSlots) {
    const d = parseDate(slot.date)
    if (d >= calendarStart && d < calendarEndExclusive) {
      eventWeeks.add(weekIndexForDate(d, calendarStart))
    }
  }

  const steadyStateSlots = generateSteadyStateSlots(
    calendarStart,
    weeks,
    postsPerWeek,
    eventWeeks,
    pillarByKey,
  )

  const allSlots = [...eventSlots, ...steadyStateSlots].filter((slot) => {
    const d = parseDate(slot.date)
    return d >= calendarStart && d < calendarEndExclusive
  })

  allSlots.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return allSlots
}

/** True if `eventDate` falls within [startDate, startDate + weeks*7). Used for request validation. */
export function isDateWithinCalendarSpan(eventDate: string, startDate: string, weeks: number): boolean {
  const start = parseDate(startDate)
  const end = addDays(start, weeks * 7)
  const d = parseDate(eventDate)
  return d >= start && d < end
}
