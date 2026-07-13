// Server-side only. Works purely with pillar keys grouped by category — no
// pillar descriptions here, so it carries no IP, but it's kept alongside the
// other server-only prompt-building logic for consistency.

export type PillarCategory = 'membership' | 'donor'

export type CalendarSlot = {
  date: string // YYYY-MM-DD
  pillarKey: string
  category: PillarCategory
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Cycles through a pillar set in shuffled order, reshuffling once exhausted.
 * `next(avoid)` swaps the freshly-reshuffled queue's first two entries when
 * the first would repeat the immediately preceding pick — the only point a
 * same-category run can produce a back-to-back duplicate.
 */
class PillarQueue {
  private readonly keys: string[]
  private queue: string[] = []

  constructor(keys: string[]) {
    this.keys = keys
  }

  next(avoid?: string): string {
    if (this.queue.length === 0) {
      this.queue = shuffle(this.keys)
      if (avoid && this.queue.length > 1 && this.queue[0] === avoid) {
        ;[this.queue[0], this.queue[1]] = [this.queue[1], this.queue[0]]
      }
    }
    return this.queue.shift()!
  }
}

/**
 * Generates a sequence of dated, pillar-assigned post slots.
 *
 * - Posts within a week are evenly spread across the 7-day week starting
 *   from `startDate`'s weekday (e.g. 2/week lands roughly 3-4 days apart).
 * - Pillars follow a repeating membership/membership/donor pattern, which
 *   gives an exact 2:1 membership:donor ratio for post counts divisible by
 *   3 and stays close to it otherwise.
 * - The same specific pillar is never assigned to two consecutive posts.
 */
export function generateCalendarSlots(
  startDate: string,
  weeks: number,
  postsPerWeek: number,
  membershipKeys: string[],
  donorKeys: string[],
): CalendarSlot[] {
  const totalPosts = weeks * postsPerWeek
  const start = new Date(`${startDate}T00:00:00Z`)

  const membershipQueue = new PillarQueue(membershipKeys)
  const donorQueue = new PillarQueue(donorKeys)

  const slots: CalendarSlot[] = []
  let previousKey: string | undefined

  for (let index = 0; index < totalPosts; index++) {
    const week = Math.floor(index / postsPerWeek)
    const postInWeek = index % postsPerWeek
    const dayOffset = Math.floor((postInWeek * 7) / postsPerWeek)
    const date = toISODate(addDays(start, week * 7 + dayOffset))

    const category: PillarCategory = index % 3 === 2 ? 'donor' : 'membership'
    const queue = category === 'donor' ? donorQueue : membershipQueue
    const pillarKey = queue.next(previousKey)

    slots.push({ date, pillarKey, category })
    previousKey = pillarKey
  }

  return slots
}
