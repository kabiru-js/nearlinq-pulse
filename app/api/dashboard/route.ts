import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, animals } from '@/db'
import type { HealthStatus } from '@/lib/model'
import { getSessionUser } from '@/lib/auth'
import { jsonError } from '@/lib/http'

function round1(n: number) {
  return Math.round(n * 10) / 10
}

/**
 * GET /api/dashboard - herd-level metrics computed from each animal's
 * latest vital reading, scoped to the session user's organization.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request)
  if (!user) return jsonError(401, 'Unauthorized')

  const rows = await db.query.animals.findMany({
    where: eq(animals.organizationId, user.orgId),
    with: {
      vitals: {
        orderBy: (vitals, { desc }) => [desc(vitals.recordedAt)],
        limit: 1,
      },
    },
  })

  const latest = rows.flatMap((row) => (row.vitals[0] ? [row.vitals[0]] : []))
  const total = rows.length
  const count = (status: HealthStatus) =>
    latest.filter((v) => v.healthStatus === status).length
  const avg = (fn: (v: (typeof latest)[number]) => number) =>
    latest.length === 0 ? 0 : Math.round(latest.reduce((sum, v) => sum + fn(v), 0) / latest.length)

  return NextResponse.json({
    total,
    healthy: count('healthy'),
    warning: count('warning'),
    critical: count('critical'),
    healthPercentage:
      total === 0 ? 0 : Math.round((count('healthy') / total) * 100),
    avgHeartRate: avg((v) => v.heartRate),
    avgTemperature: round1(avg((v) => Number(v.temperatureC))),
    avgOxygen: avg((v) => v.oxygenPct),
    updatedAt: new Date().toISOString(),
  })
}
