import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_CODE, findAccessCode } from '@/lib/accessCodes'
import { corsHeaders } from '@/lib/cors'

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  const body = await req.json().catch(() => null)
  const code = typeof body?.accessCode === 'string' ? body.accessCode.trim() : ''

  if (!code) {
    return NextResponse.json(
      { valid: false, error: 'Access code is required.' },
      { status: 400, headers },
    )
  }

  if (code === ADMIN_CODE) {
    return NextResponse.json({ valid: true, isAdmin: true }, { headers })
  }

  const account = findAccessCode(code)
  if (!account) {
    return NextResponse.json(
      { valid: false, error: 'Invalid access code.' },
      { status: 401, headers },
    )
  }

  return NextResponse.json(
    { valid: true, isAdmin: false, label: account.label },
    { headers },
  )
}
