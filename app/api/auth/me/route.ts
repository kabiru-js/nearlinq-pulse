import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { jsonError } from '@/lib/http'

/**
 * GET /api/auth/me - current session user, or 401.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request)
  if (!user) return jsonError(401, 'Unauthorized')
  return NextResponse.json({ user })
}
