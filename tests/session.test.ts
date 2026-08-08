import { beforeAll, describe, expect, it } from 'vitest'
import { createSession, verifySession } from '@/lib/session'

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-for-unit-tests'
})

describe('session', () => {
  it('round-trips a session', async () => {
    const token = await createSession({
      sub: 'user-1',
      orgId: 'org-1',
      email: 'a@b.com',
      name: 'Alice',
    })
    const user = await verifySession(token)
    expect(user).toEqual({
      sub: 'user-1',
      orgId: 'org-1',
      email: 'a@b.com',
      name: 'Alice',
    })
  })

  it('rejects a tampered token', async () => {
    const token = await createSession({
      sub: 'user-1',
      orgId: 'org-1',
      email: 'a@b.com',
      name: 'Alice',
    })
    const tampered = token.slice(0, -6) + 'AAAAAA'
    expect(await verifySession(tampered)).toBeNull()
  })

  it('rejects garbage input', async () => {
    expect(await verifySession('not-a-jwt')).toBeNull()
  })
})
