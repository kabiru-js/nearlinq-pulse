import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'nearling_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface SessionUser {
  /** User id */
  sub: string
  /** Organization the user belongs to - every query is scoped by this. */
  orgId: string
  email: string
  name: string
}

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (secret) return new TextEncoder().encode(secret)
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is not set - generate one with: openssl rand -base64 32')
  }
  console.warn(
    '[auth] AUTH_SECRET not set - using an insecure dev-only secret. Set AUTH_SECRET in production.'
  )
  return new TextEncoder().encode('nearling-dev-only-secret-do-not-use')
}

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ orgId: user.orgId, email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (!payload.sub || !payload.orgId) return null
    return {
      sub: payload.sub,
      orgId: String(payload.orgId),
      email: typeof payload.email === 'string' ? payload.email : '',
      name: typeof payload.name === 'string' ? payload.name : '',
    }
  } catch {
    return null
  }
}
