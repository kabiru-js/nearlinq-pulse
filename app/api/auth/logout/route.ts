import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

/**
 * POST /api/auth/logout - clears the session cookie.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  })
  return res
}
