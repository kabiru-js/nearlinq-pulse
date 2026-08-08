import { NextRequest, NextResponse } from 'next/server'
import { and, eq, desc } from 'drizzle-orm'
import { db, animals, vitals, checkups } from '@/db'
import { getSessionUser } from '@/lib/auth'
import { jsonError } from '@/lib/http'

/**
 * GET /api/animals/[id] - animal detail with vitals history and checkups,
 * scoped to the session user's organization.
 * ?limit=N controls how many vital readings are returned (default 100, max 500).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request)
  if (!user) return jsonError(401, 'Unauthorized')

  const { id } = await params
  const limit = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get('limit') ?? 100), 1),
    500
  )

  const animal = await db.query.animals.findFirst({
    where: and(eq(animals.id, id), eq(animals.organizationId, user.orgId)),
  })
  if (!animal) return jsonError(404, 'animal not found')

  const [vitalsRows, checkupRows] = await Promise.all([
    db
      .select()
      .from(vitals)
      .where(eq(vitals.animalId, id))
      .orderBy(desc(vitals.recordedAt))
      .limit(limit),
    db
      .select()
      .from(checkups)
      .where(eq(checkups.animalId, id))
      .orderBy(desc(checkups.performedAt)),
  ])

  const vitalList = vitalsRows.map((v) => ({
    id: v.id,
    animalId: v.animalId,
    heartRate: v.heartRate,
    pulse: v.pulse,
    temperatureC: Number(v.temperatureC),
    oxygenPct: v.oxygenPct,
    digestScore: v.digestScore,
    healthStatus: v.healthStatus,
    confidence: Number(v.confidence),
    recordedAt: v.recordedAt.toISOString(),
  }))

  const checkupList = checkupRows.map((c) => ({
    id: c.id,
    animalId: c.animalId,
    performedBy: c.performedBy,
    weightKg: c.weightKg ? Number(c.weightKg) : null,
    notes: c.notes,
    verdict: c.verdict,
    performedAt: c.performedAt.toISOString(),
  }))

  return NextResponse.json({
    animal: {
      id: animal.id,
      name: animal.name,
      type: animal.type,
      birthDate: animal.birthDate?.toISOString() ?? null,
      weightKg: animal.weightKg ? Number(animal.weightKg) : null,
      location: animal.location,
    },
    vitals: vitalList,
    checkups: checkupList,
  })
}
