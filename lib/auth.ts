import { NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession, type SessionUser } from './session'

/**
 * Returns the session user for a request, or null when unauthenticated.
 * Route handlers use this to scope queries by organization.
 */
export async function getSessionUser(
  request: NextRequest
): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySession(token)
}
