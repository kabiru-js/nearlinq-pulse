import { NextRequest, NextResponse } from 'next/server'
import { and, eq, desc } from 'drizzle-orm'
import { db, animals, checkups } from '@/db'
import { getSessionUser } from '@/lib/auth'
import { jsonError } from '@/lib/http'
import { checkupSchema } from '@/lib/validation'

async function scopedAnimal(id: string, orgId: string) {
  return db.query.animals.findFirst({
    where: and(eq(animals.id, id), eq(animals.organizationId, orgId)),
  })
}

/**
 * GET /api/animals/[id]/checkups - list check-ups, scoped to the user's org.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request)
  if (!user) return jsonError(401, 'Unauthorized')

  const { id } = await params
  const animal = await scopedAnimal(id, user.orgId)
  if (!animal) return jsonError(404, 'animal not found')

  const rows = await db
    .select()
    .from(checkups)
    .where(eq(checkups.animalId, id))
    .orderBy(desc(checkups.performedAt))

  return NextResponse.json(rows)
}

/**
 * POST /api/animals/[id]/checkups - record a vet check-up.
 * Recording a weight also keeps the animal record in sync.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(request)
  if (!user) return jsonError(401, 'Unauthorized')

  const { id } = await params
  const animal = await scopedAnimal(id, user.orgId)
  if (!animal) return jsonError(404, 'animal not found')

  const body = await request.json().catch(() => null)
  const parsed = checkupSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(400, 'invalid checkup payload', {
      issues: parsed.error.flatten(),
    })
  }

  const [row] = await db
    .insert(checkups)
    .values({
      animalId: id,
      performedBy: parsed.data.performedBy ?? null,
      weightKg: parsed.data.weightKg != null ? String(parsed.data.weightKg) : null,
      notes: parsed.data.notes ?? null,
      verdict: parsed.data.verdict ?? null,
    })
    .returning()

  if (parsed.data.weightKg != null) {
    await db
      .update(animals)
      .set({ weightKg: String(parsed.data.weightKg) })
      .where(eq(animals.id, id))
  }

  return NextResponse.json(row, { status: 201 })
}
