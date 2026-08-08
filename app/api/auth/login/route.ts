import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, users } from '@/db'
import { jsonError } from '@/lib/http'
import { loginSchema } from '@/lib/validation'
import { SESSION_COOKIE, SESSION_MAX_AGE, createSession } from '@/lib/session'

/**
 * POST /api/auth/login - email + password login.
 * Sets an httpOnly session cookie on success.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(400, 'invalid credentials payload', {
      issues: parsed.error.flatten(),
    })
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })
  if (!user || !bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
    return jsonError(401, 'invalid email or password')
  }

  const token = await createSession({
    sub: user.id,
    orgId: user.organizationId,
    email: user.email,
    name: user.name,
  })

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
