import { describe, expect, it } from 'vitest'
import { checkupSchema, loginSchema, vitalsIngestSchema } from '@/lib/validation'

const validVitals = {
  animalId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  heartRate: 70,
  pulse: 72,
  temperatureC: 38.2,
  oxygenPct: 98,
  digestScore: 92,
}

describe('vitalsIngestSchema', () => {
  it('accepts a valid payload', () => {
    expect(vitalsIngestSchema.safeParse(validVitals).success).toBe(true)
  })

  it('rejects a non-uuid animalId', () => {
    const parsed = vitalsIngestSchema.safeParse({ ...validVitals, animalId: 'COW-001' })
    expect(parsed.success).toBe(false)
  })

  it('rejects out-of-range vitals', () => {
    expect(vitalsIngestSchema.safeParse({ ...validVitals, temperatureC: 50 }).success).toBe(false)
    expect(vitalsIngestSchema.safeParse({ ...validVitals, oxygenPct: 20 }).success).toBe(false)
    expect(vitalsIngestSchema.safeParse({ ...validVitals, heartRate: 500 }).success).toBe(false)
  })

  it('accepts an optional ISO recordedAt', () => {
    const parsed = vitalsIngestSchema.safeParse({
      ...validVitals,
      recordedAt: '2026-08-06T09:30:00.000Z',
    })
    expect(parsed.success).toBe(true)
  })
})

describe('checkupSchema', () => {
  it('accepts an empty checkup', () => {
    expect(checkupSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a full checkup with verdict', () => {
    const parsed = checkupSchema.safeParse({
      performedBy: 'Dr. Smith',
      weightKg: 620.5,
      notes: 'Good condition',
      verdict: 'healthy',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects an invalid verdict', () => {
    const parsed = checkupSchema.safeParse({ verdict: 'excellent' })
    expect(parsed.success).toBe(false)
  })

  it('rejects negative weight', () => {
    expect(checkupSchema.safeParse({ weightKg: -5 }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts a valid email + password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'secret' }).success).toBe(true)
  })

  it('rejects a malformed email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'secret' }).success).toBe(false)
  })

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })
})
