import { NextRequest, NextResponse } from 'next/server'
import { findAccessCode } from '@/lib/accessCodes'
import {
  ALL_PILLARS_INCLUDING_EVENT,
  DONOR_PILLARS,
  MEMBERSHIP_PILLARS,
  type Pillar,
} from '@/lib/pillars'
import {
  SYSTEM_PROMPT,
  buildEventCalendarUserMessage,
  parseCaptionsResponse,
  type IndexedCalendarSlot,
} from '@/lib/prompts'
import {
  generateEventAnchoredCalendar,
  isDateWithinCalendarSpan,
  type EventInput,
} from '@/lib/calendarSequencing'
import { getVisualTemplate } from '@/lib/visualTemplates'
import { getAnthropicClient } from '@/lib/anthropic'
import { incrementUsage } from '@/lib/usage'
import { corsHeaders } from '@/lib/cors'

// Posts-per-week bounds, enforced here regardless of what the client sends.
const MIN_POSTS_PER_WEEK = 1
const MAX_POSTS_PER_WEEK = 5
const DEFAULT_POSTS_PER_WEEK = 2

// A single batched call requests every platform variant for every post at
// once, so the calendar length is capped to keep that one request's token
// count and runtime bounded. 13 weeks = one fiscal quarter (52-week year /
// 4); at 5 posts/week that's 65 steady-state-only posts max, before events
// add more.
const MIN_WEEKS = 1
const MAX_WEEKS = 13

// Each event can add up to ~7 posts (3 sponsorship touchpoints + promo +
// event day + thank-you + spotlight), on top of steady-state, so this is
// capped independently to keep worst-case calendar size sane.
const MAX_EVENTS = 12

function getPillarCategory(pillarKey: string): 'membership' | 'donor' | 'event' {
  if (MEMBERSHIP_PILLARS.some((p) => p.key === pillarKey)) return 'membership'
  if (DONOR_PILLARS.some((p) => p.key === pillarKey)) return 'donor'
  return 'event'
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400, headers })
  }

  const {
    accessCode,
    orgName,
    missionStatement,
    event,
    toneNote,
    keyFacts,
    startDate,
    weeks,
    postsPerWeek,
    events: rawEvents,
  } = body ?? {}

  if (typeof accessCode !== 'string' || !accessCode.trim()) {
    return NextResponse.json({ error: 'Access code is required.' }, { status: 401, headers })
  }
  const account = findAccessCode(accessCode.trim())
  if (!account) {
    return NextResponse.json({ error: 'Invalid access code.' }, { status: 401, headers })
  }

  if (typeof orgName !== 'string' || !orgName.trim()) {
    return NextResponse.json(
      { error: 'Organization name is required.' },
      { status: 400, headers },
    )
  }

  if (
    typeof startDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    Number.isNaN(new Date(`${startDate}T00:00:00Z`).getTime())
  ) {
    return NextResponse.json({ error: 'A valid start date is required.' }, { status: 400, headers })
  }

  const weeksNum = Number(weeks)
  if (!Number.isInteger(weeksNum) || weeksNum < MIN_WEEKS || weeksNum > MAX_WEEKS) {
    return NextResponse.json(
      { error: `Number of weeks must be a whole number between ${MIN_WEEKS} and ${MAX_WEEKS}.` },
      { status: 400, headers },
    )
  }

  // Posts per week: default to 2 when omitted, but clamp/reject anything
  // outside [1, 5] rather than silently accepting it — the client clamps
  // too, but this endpoint must not trust that alone.
  const postsPerWeekRaw =
    postsPerWeek === undefined || postsPerWeek === null || postsPerWeek === ''
      ? DEFAULT_POSTS_PER_WEEK
      : Number(postsPerWeek)
  if (
    !Number.isInteger(postsPerWeekRaw) ||
    postsPerWeekRaw < MIN_POSTS_PER_WEEK ||
    postsPerWeekRaw > MAX_POSTS_PER_WEEK
  ) {
    return NextResponse.json(
      {
        error: `Posts per week must be a whole number between ${MIN_POSTS_PER_WEEK} and ${MAX_POSTS_PER_WEEK}.`,
      },
      { status: 400, headers },
    )
  }
  const postsPerWeekNum = postsPerWeekRaw

  // Events: optional, repeatable {name, date, hasSponsors}. Each event's
  // date must fall within the calendar span — reject rather than silently
  // dropping event content the caller clearly asked for.
  const eventsInput = Array.isArray(rawEvents) ? rawEvents : []
  if (eventsInput.length > MAX_EVENTS) {
    return NextResponse.json(
      { error: `No more than ${MAX_EVENTS} events per calendar.` },
      { status: 400, headers },
    )
  }
  const events: EventInput[] = []
  for (const raw of eventsInput) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : ''
    const date = typeof raw?.date === 'string' ? raw.date : ''
    const hasSponsors = raw?.hasSponsors === true

    if (!name) {
      return NextResponse.json({ error: 'Every event needs a name.' }, { status: 400, headers })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
      return NextResponse.json(
        { error: `Event "${name}" needs a valid date.` },
        { status: 400, headers },
      )
    }
    if (!isDateWithinCalendarSpan(date, startDate, weeksNum)) {
      return NextResponse.json(
        {
          error: `Event "${name}"'s date must fall within the selected calendar range (starting ${startDate}, ${weeksNum} week${weeksNum === 1 ? '' : 's'}).`,
        },
        { status: 400, headers },
      )
    }
    events.push({ name, date, hasSponsors })
  }

  const pillarByKey = new Map<string, Pillar>(ALL_PILLARS_INCLUDING_EVENT.map((p) => [p.key, p]))

  const slots = generateEventAnchoredCalendar(startDate, weeksNum, postsPerWeekNum, events, pillarByKey)
  if (slots.length === 0) {
    return NextResponse.json(
      { error: 'No posts could be scheduled for the selected range. Try a wider date range.' },
      { status: 400, headers },
    )
  }

  const indexedSlots: IndexedCalendarSlot[] = slots.map((slot, i) => ({
    index: i + 1,
    date: slot.date,
    phase: slot.phase,
    eventName: slot.eventName,
    pillarOptions: slot.pillarOptions,
    notes: slot.notes,
  }))

  const userMessage = buildEventCalendarUserMessage(
    {
      orgName: orgName.trim(),
      missionStatement: typeof missionStatement === 'string' ? missionStatement : undefined,
      event: typeof event === 'string' ? event : undefined,
      toneNote: typeof toneNote === 'string' ? toneNote : undefined,
      keyFacts: typeof keyFacts === 'string' ? keyFacts : undefined,
    },
    indexedSlots,
  )

  // 5 platform variants + a visual label per post is far more output than
  // the old single-caption calendar — budget generously (~550 tokens/post)
  // and stream the request so a large calendar can't hit the SDK's
  // non-streaming timeout guard or a serverless function timeout.
  const maxTokens = Math.min(64_000, Math.max(2_000, 500 + slots.length * 550))

  try {
    const anthropic = getAnthropicClient()
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })
    const response = await stream.finalMessage()

    const textBlock = response.content.find(
      (block): block is { type: 'text'; text: string } => block.type === 'text',
    )
    if (!textBlock) {
      return NextResponse.json(
        { error: 'The model did not return any text.' },
        { status: 502, headers },
      )
    }

    let parsed: unknown
    try {
      parsed = parseCaptionsResponse(textBlock.text)
    } catch {
      console.error('Failed to parse calendar captions JSON:', textBlock.text)
      return NextResponse.json(
        { error: 'The model returned an unexpected response format.' },
        { status: 502, headers },
      )
    }
    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: 'The model returned an unexpected response format.' },
        { status: 502, headers },
      )
    }

    type ModelResult = {
      pillar?: string
      visualLabel: string
      captionX: string
      captionTikTok: string
      captionInstagram: string
      captionFacebook: string
      captionLinkedin: string
    }
    const resultByIndex = new Map<number, ModelResult>()
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || typeof (item as any).index !== 'number') continue
      const raw = item as any
      resultByIndex.set(raw.index, {
        pillar: typeof raw.pillar === 'string' ? raw.pillar : undefined,
        visualLabel: typeof raw.visual_label === 'string' ? raw.visual_label : '',
        captionX: typeof raw.caption_x === 'string' ? raw.caption_x : '',
        captionTikTok: typeof raw.caption_tiktok === 'string' ? raw.caption_tiktok : '',
        captionInstagram: typeof raw.caption_instagram === 'string' ? raw.caption_instagram : '',
        captionFacebook: typeof raw.caption_facebook === 'string' ? raw.caption_facebook : '',
        captionLinkedin: typeof raw.caption_linkedin === 'string' ? raw.caption_linkedin : '',
      })
    }

    const posts = indexedSlots.map((slot) => {
      const result = resultByIndex.get(slot.index)

      // Fixed slots: always use the known pillar, ignore whatever the model
      // echoed back. Ambiguous slots (post-event spotlight): trust the
      // model's choice only if it's one of the offered candidates.
      let pillar: Pillar
      if (slot.pillarOptions.length === 1) {
        pillar = slot.pillarOptions[0]
      } else {
        pillar =
          slot.pillarOptions.find((p) => p.key === result?.pillar) ?? slot.pillarOptions[0]
      }

      return {
        index: slot.index,
        date: slot.date,
        phase: slot.phase,
        eventName: slot.eventName ?? null,
        pillarKey: pillar.key,
        pillarLabel: pillar.label,
        category: getPillarCategory(pillar.key),
        visualTemplate: getVisualTemplate(pillar.key),
        visualLabel: result?.visualLabel ?? '',
        captionX: result?.captionX ?? '',
        captionTikTok: result?.captionTikTok ?? '',
        captionInstagram: result?.captionInstagram ?? '',
        captionFacebook: result?.captionFacebook ?? '',
        captionLinkedin: result?.captionLinkedin ?? '',
        notes: slot.notes ?? '',
      }
    })

    const missingCount = posts.filter((p) => !p.captionX && !p.captionLinkedin).length
    if (missingCount > 0) {
      console.warn(
        `Calendar generation: ${missingCount} of ${posts.length} posts came back without captions.`,
      )
    }

    await incrementUsage(account.code)

    return NextResponse.json({ posts }, { headers })
  } catch (err) {
    console.error('Calendar generation failed:', err)
    return NextResponse.json(
      { error: 'Something went wrong generating the calendar. Please try again.' },
      { status: 500, headers },
    )
  }
}
