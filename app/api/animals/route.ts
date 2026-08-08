import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, animals } from '@/db'
import type { Vitals } from '@/db'
import { getSessionUser } from '@/lib/auth'
import { jsonError } from '@/lib/http'

function ageInYears(birthDate: Date | null): number | null {
  if (!birthDate) return null
  return Math.floor(
    (Date.now() - birthDate.getTime()) / (365 * 24 * 60 * 60 * 1000)
  )
}

/**
 * GET /api/animals - list animals with their latest vital reading,
 * scoped to the session user's organization.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request)
  if (!user) return jsonError(401, 'Unauthorized')

  const rows = await db.query.animals.findMany({
    where: eq(animals.organizationId, user.orgId),
    orderBy: (animals, { asc }) => [asc(animals.name)],
    with: {
      vitals: {
        orderBy: (vitals, { desc }) => [desc(vitals.recordedAt)],
        limit: 1,
      },
    },
  })

  const animalList = rows.map((row) => {
    const latest: Vitals | undefined = row.vitals[0]
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      age: ageInYears(row.birthDate),
      weight: row.weightKg ? Number(row.weightKg) : null,
      location: row.location,
      healthStatus: latest?.healthStatus ?? 'unknown',
      confidence: latest ? Number(latest.confidence) : null,
      heartRate: latest?.heartRate ?? null,
      pulse: latest?.pulse ?? null,
      temperature: latest ? Number(latest.temperatureC) : null,
      oxygenLevel: latest?.oxygenPct ?? null,
      digestScore: latest?.digestScore ?? null,
      lastCheckup: latest?.recordedAt.toISOString() ?? null,
    }
  })

  return NextResponse.json(animalList)
}
