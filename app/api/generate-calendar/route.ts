import { NextRequest, NextResponse } from 'next/server'
import { findAccessCode } from '@/lib/accessCodes'
import { ALL_PILLARS, DONOR_PILLARS, MEMBERSHIP_PILLARS, type Pillar } from '@/lib/pillars'
import { SYSTEM_PROMPT, buildCalendarUserMessage, parseCaptionsResponse } from '@/lib/prompts'
import { generateCalendarSlots } from '@/lib/calendarSequencing'
import { getAnthropicClient } from '@/lib/anthropic'
import { incrementUsage } from '@/lib/usage'
import { corsHeaders } from '@/lib/cors'

// Posts-per-week bounds, enforced here regardless of what the client sends.
const MIN_POSTS_PER_WEEK = 1
const MAX_POSTS_PER_WEEK = 5
const DEFAULT_POSTS_PER_WEEK = 2

// A single batched call requests captions for every post at once, so the
// calendar length is capped to keep that one request's token count and
// runtime bounded (avoids Vercel function timeouts / SDK HTTP timeouts on a
// very large non-streaming request). 13 weeks = one fiscal quarter (52-week
// year / 4); at 5 posts/week that's 65 posts max in a single call.
const MIN_WEEKS = 1
const MAX_WEEKS = 13

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

  const { accessCode, orgName, missionStatement, event, toneNote, startDate, weeks, postsPerWeek } =
    body ?? {}

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

  const membershipKeys = MEMBERSHIP_PILLARS.map((p) => p.key)
  const donorKeys = DONOR_PILLARS.map((p) => p.key)
  const pillarByKey = new Map<string, Pillar>(ALL_PILLARS.map((p) => [p.key, p]))

  const slots = generateCalendarSlots(startDate, weeksNum, postsPerWeekNum, membershipKeys, donorKeys)

  const userMessage = buildCalendarUserMessage(
    {
      orgName: orgName.trim(),
      missionStatement: typeof missionStatement === 'string' ? missionStatement : undefined,
      event: typeof event === 'string' ? event : undefined,
      toneNote: typeof toneNote === 'string' ? toneNote : undefined,
    },
    slots.map((slot, i) => ({ index: i + 1, date: slot.date, pillar: pillarByKey.get(slot.pillarKey)! })),
  )

  // Roughly budget for the whole batch in one shot: ~130 tokens per caption
  // plus overhead, clamped to a range that avoids both truncation on large
  // calendars and needlessly large requests on small ones.
  const maxTokens = Math.min(8000, Math.max(1000, 200 + slots.length * 130))

  try {
    const anthropic = getAnthropicClient()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

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

    const captionByIndex = new Map<number, string>()
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as any).index === 'number' &&
        typeof (item as any).caption === 'string'
      ) {
        captionByIndex.set((item as any).index, (item as any).caption)
      }
    }

    const posts = slots.map((slot, i) => {
      const pillar = pillarByKey.get(slot.pillarKey)!
      return {
        index: i + 1,
        date: slot.date,
        pillarKey: pillar.key,
        pillarLabel: pillar.label,
        category: slot.category,
        caption: captionByIndex.get(i + 1) ?? '',
      }
    })

    const missingCount = posts.filter((p) => !p.caption).length
    if (missingCount > 0) {
      console.warn(
        `Calendar generation: ${missingCount} of ${posts.length} captions were missing from the model response.`,
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
