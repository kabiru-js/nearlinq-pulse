import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

/**
 * Protects pages and API routes with the session cookie.
 *
 * - Pages: redirect to /login when unauthenticated.
 * - API: return 401 (route handlers also enforce scoping, this is a first line).
 * - /api/auth/* stays public.
 * - Demo mode (NEXT_PUBLIC_DEMO_MODE=true) skips auth entirely.
 */
export async function proxy(request: NextRequest) {
  if (DEMO_MODE) return NextResponse.next()

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const user = token ? await verifySession(token) : null

  const { pathname } = request.nextUrl
  console.log(`[proxy] ${request.method} ${pathname} ${user ? 'auth' : 'anon'}`)

  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/auth/')) return NextResponse.next()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.next()
  }

  if (pathname === '/login') {
    if (user) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
