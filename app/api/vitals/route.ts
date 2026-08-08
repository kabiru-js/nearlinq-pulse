import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db, organizations, animals, vitals } from '@/db'
import { jsonError } from '@/lib/http'
import { rateLimit, __pruneBuckets } from '@/lib/rate-limit'
import { vitalsIngestSchema } from '@/lib/validation'
import { analyzeVitals } from '@/lib/model'

/**
 * POST /api/vitals - sensor ingestion endpoint.
 *
 * Flow: rate-limit by ingest key -> validate the org's key -> validate
 * payload -> check the animal belongs to that org -> run health analysis
 * (your model, or the rule-based fallback) -> store vital + verdict.
 */
export async function POST(request: NextRequest) {
  __pruneBuckets()

  const key = request.headers.get('x-ingest-key') ?? 'unknown'
  const limit = rateLimit(key)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'rate limit exceeded' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((limit.retryAfterMs ?? 1000) / 1000)) },
      }
    )
  }

  const org = key && key !== 'unknown'
    ? await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.ingestKey, key))
        .limit(1)
    : []
  if (org.length === 0) {
    return jsonError(401, 'invalid or missing X-Ingest-Key header')
  }
  const orgId = org[0].id

  const body = await request.json().catch(() => null)
  const parsed = vitalsIngestSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(400, 'invalid vitals payload', {
      issues: parsed.error.flatten(),
    })
  }

  const input = parsed.data
  const animal = await db
    .select({ id: animals.id })
    .from(animals)
    .where(and(eq(animals.id, input.animalId), eq(animals.organizationId, orgId)))
    .limit(1)
  if (animal.length === 0) return jsonError(404, 'animal not found')

  const analysis = await analyzeVitals({
    animalId: input.animalId,
    heartRate: input.heartRate,
    pulse: input.pulse,
    temperatureC: input.temperatureC,
    oxygenPct: input.oxygenPct,
    digestScore: input.digestScore,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  })

  const values: typeof vitals.$inferInsert = {
    animalId: input.animalId,
    heartRate: input.heartRate,
    pulse: input.pulse,
    temperatureC: String(input.temperatureC),
    oxygenPct: input.oxygenPct,
    digestScore: input.digestScore,
    healthStatus: analysis.healthStatus,
    confidence: String(analysis.confidence),
  }
  if (input.recordedAt) values.recordedAt = new Date(input.recordedAt)

  const [vital] = await db.insert(vitals).values(values).returning()

  return NextResponse.json({ vital, analysis }, { status: 201 })
}
