import { NextRequest, NextResponse } from 'next/server'
import { findAccessCode } from '@/lib/accessCodes'
import { getPillarsForContentType, type ContentType } from '@/lib/pillars'
import { buildUserMessage, parseCaptionsResponse, SYSTEM_PROMPT } from '@/lib/prompts'
import { getAnthropicClient } from '@/lib/anthropic'
import { incrementUsage } from '@/lib/usage'
import { corsHeaders } from '@/lib/cors'

const VALID_CONTENT_TYPES: ContentType[] = ['Membership', 'Donor', 'Combined']

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
    contentType,
    missionStatement,
    event,
    toneNote,
    keyFacts,
    pillars: selectedPillarKeys,
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

  if (!VALID_CONTENT_TYPES.includes(contentType)) {
    return NextResponse.json({ error: 'Invalid content type.' }, { status: 400, headers })
  }

  const pillars = getPillarsForContentType(
    contentType,
    Array.isArray(selectedPillarKeys) ? selectedPillarKeys.filter((k) => typeof k === 'string') : [],
  )
  if (pillars.length === 0) {
    return NextResponse.json(
      { error: 'Select at least one content pillar.' },
      { status: 400, headers },
    )
  }

  const userMessage = buildUserMessage(
    {
      orgName: orgName.trim(),
      missionStatement: typeof missionStatement === 'string' ? missionStatement : undefined,
      event: typeof event === 'string' ? event : undefined,
      toneNote: typeof toneNote === 'string' ? toneNote : undefined,
      keyFacts: typeof keyFacts === 'string' ? keyFacts : undefined,
    },
    pillars,
  )

  try {
    const anthropic = getAnthropicClient()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
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

    let captions: unknown
    try {
      captions = parseCaptionsResponse(textBlock.text)
    } catch {
      console.error('Failed to parse captions JSON:', textBlock.text)
      return NextResponse.json(
        { error: 'The model returned an unexpected response format.' },
        { status: 502, headers },
      )
    }

    await incrementUsage(account.code)

    return NextResponse.json({ captions }, { headers })
  } catch (err) {
    console.error('Caption generation failed:', err)
    return NextResponse.json(
      { error: 'Something went wrong generating captions. Please try again.' },
      { status: 500, headers },
    )
  }
}
