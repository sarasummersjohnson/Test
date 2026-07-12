import type { NextRequest } from 'next/server'

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGIN || ''
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

/**
 * Builds CORS headers for a request. If ALLOWED_ORIGIN isn't set yet, falls
 * back to echoing the request's own origin (or "*") so local dev and
 * same-origin (iframe) usage are never blocked. Once ALLOWED_ORIGIN is set
 * (e.g. to your Squarespace domain), only matching origins are allowed.
 */
export function corsHeaders(req: NextRequest): HeadersInit {
  const origin = req.headers.get('origin') || ''
  const allowed = getAllowedOrigins()

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }

  if (allowed.length === 0) {
    headers['Access-Control-Allow-Origin'] = origin || '*'
  } else if (allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}
