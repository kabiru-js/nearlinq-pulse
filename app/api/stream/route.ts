import { NextRequest } from 'next/server'
import { and, desc, eq, gt } from 'drizzle-orm'
import { db, animals, vitals } from '@/db'
import { getSessionUser } from '@/lib/auth'
import { jsonError } from '@/lib/http'

export const dynamic = 'force-dynamic'

const POLL_INTERVAL_MS = 5000

/**
 * GET /api/stream - Server-Sent Events stream.
 *
 * Pushes a "vitals" event whenever new readings land in the database for
 * the session user's organization. The stream polls Postgres itself (no
 * broker required), so it works on a single-node deployment.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request)
  if (!user) return jsonError(401, 'Unauthorized')

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown, event: string) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      send({ type: 'connected' }, 'message')

      // Catch readings that landed moments before this stream connected.
      let since = new Date(Date.now() - POLL_INTERVAL_MS)

      const interval = setInterval(async () => {
        try {
          const rows = await db
            .select({ animalId: vitals.animalId, recordedAt: vitals.recordedAt })
            .from(vitals)
            .innerJoin(animals, eq(vitals.animalId, animals.id))
            .where(
              and(gt(vitals.recordedAt, since), eq(animals.organizationId, user.orgId))
            )
            .orderBy(desc(vitals.recordedAt))
            .limit(50)

          if (rows.length > 0) {
            const newest = rows[0].recordedAt
            if (newest > since) since = newest
            const animalIds = [...new Set(rows.map((r) => r.animalId))]
            send({ type: 'vitals', animalIds, count: rows.length }, 'vitals')
          } else {
            // Keepalive comment so idle proxies don't close the connection.
            controller.enqueue(encoder.encode(': ping\n\n'))
          }
        } catch {
          // DB unreachable - keep the stream alive; the client's heartbeat
          // fallback (or polling mode) will cover any missed updates.
        }
      }, POLL_INTERVAL_MS)

      request.signal.addEventListener('abort', () => clearInterval(interval))
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
