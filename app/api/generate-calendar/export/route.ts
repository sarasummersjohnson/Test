import { NextRequest, NextResponse } from 'next/server'
import { findAccessCode } from '@/lib/accessCodes'
import { buildCalendarWorkbook, type CalendarPostRow } from '@/lib/excelExport'
import { corsHeaders } from '@/lib/cors'

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

// Formats an already-generated calendar into an .xlsx file. Takes the
// posts array the client already has in memory — no Claude call and no
// usage increment here, this is pure formatting.
export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400, headers })
  }

  const { accessCode, orgName, posts } = body ?? {}

  if (typeof accessCode !== 'string' || !findAccessCode(accessCode.trim())) {
    return NextResponse.json({ error: 'Invalid access code.' }, { status: 401, headers })
  }
  if (!Array.isArray(posts) || posts.length === 0) {
    return NextResponse.json({ error: 'No posts to export.' }, { status: 400, headers })
  }

  const rows: CalendarPostRow[] = posts.map((post: any) => ({
    date: typeof post?.date === 'string' ? post.date : '',
    phase: typeof post?.phase === 'string' ? post.phase : '',
    pillarLabel: typeof post?.pillarLabel === 'string' ? post.pillarLabel : '',
    category:
      post?.category === 'donor' ? 'donor' : post?.category === 'event' ? 'event' : 'membership',
    visualTemplate: typeof post?.visualTemplate === 'string' ? post.visualTemplate : '',
    visualLabel: typeof post?.visualLabel === 'string' ? post.visualLabel : '',
    captionX: typeof post?.captionX === 'string' ? post.captionX : '',
    captionTikTok: typeof post?.captionTikTok === 'string' ? post.captionTikTok : '',
    captionInstagram: typeof post?.captionInstagram === 'string' ? post.captionInstagram : '',
    captionFacebook: typeof post?.captionFacebook === 'string' ? post.captionFacebook : '',
    captionLinkedin: typeof post?.captionLinkedin === 'string' ? post.captionLinkedin : '',
    notes: typeof post?.notes === 'string' ? post.notes : '',
  }))

  const buffer = await buildCalendarWorkbook(rows)

  const safeName = (typeof orgName === 'string' && orgName.trim() ? orgName.trim() : 'caption-calendar')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName || 'caption-calendar'}-posting-calendar.xlsx"`,
    },
  })
}
