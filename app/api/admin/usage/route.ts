import { NextRequest, NextResponse } from 'next/server'
import { ACCESS_CODES, ADMIN_CODE } from '@/lib/accessCodes'
import { getUsageCounts } from '@/lib/usage'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const code = typeof body?.accessCode === 'string' ? body.accessCode.trim() : ''

  if (code !== ADMIN_CODE) {
    return NextResponse.json({ error: 'Invalid admin code.' }, { status: 401 })
  }

  const counts = await getUsageCounts()
  const usage = ACCESS_CODES.map(({ code, label }) => ({
    code,
    label,
    count: counts[code] ?? 0,
  }))

  return NextResponse.json({ usage })
}
