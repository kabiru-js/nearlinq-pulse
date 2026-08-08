import 'dotenv/config'

interface SimAnimal {
  id: string
  heartRate: number
  pulse: number
  temperature: number
  oxygenLevel: number
  digestScore: number
}

/**
 * Emits jittered vital readings to the local ingestion API so the
 * dashboard behaves like a live system.
 *
 * Logs in with the seeded demo user to fetch the animal list, then posts
 * readings with the organization's ingest key.
 *
 * Usage: pnpm simulate   (dev server must be running on :3000)
 */
async function main() {
  const baseUrl = process.env.SIM_BASE_URL ?? 'http://localhost:3000'
  const ingestKey = process.env.VITALS_INGEST_KEY ?? 'change-me'
  const email = process.env.SEED_EMAIL ?? 'demo@nearling.dev'
  const password = process.env.SEED_PASSWORD ?? 'demo1234'

  // Machine login: grab the session cookie for the animal list endpoint.
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!loginRes.ok) {
    console.error(`Login failed (${loginRes.status}) - run pnpm seed first.`)
    process.exit(1)
  }
  const getSetCookie = (loginRes.headers as unknown as {
    getSetCookie?: () => string[]
  }).getSetCookie?.()
  const sessionCookie = (getSetCookie ?? [])
    .map((c) => c.split(';')[0])
    .join('; ')

  const res = await fetch(`${baseUrl}/api/animals`, {
    headers: { cookie: sessionCookie },
  })
  if (!res.ok) {
    console.error(`Could not fetch /api/animals (${res.status}) - is the dev server running?`)
    process.exit(1)
  }
  const animals: SimAnimal[] = await res.json()
  if (animals.length === 0) {
    console.error('No animals found - run `pnpm seed` first.')
    process.exit(1)
  }

  const jitter = (v: number, pct: number) =>
    Math.round(v * (1 + (Math.random() - 0.5) * 2 * pct))

  console.log(`Simulating vitals for ${animals.length} animals every 5s -> ${baseUrl}/api/vitals`)

  setInterval(async () => {
    const a = animals[Math.floor(Math.random() * animals.length)]
    const payload = {
      animalId: a.id,
      heartRate: jitter(a.heartRate, 0.08),
      pulse: jitter(a.pulse, 0.08),
      temperatureC: Math.round(a.temperature * 10 + (Math.random() - 0.5) * 6) / 10,
      oxygenPct: Math.min(100, jitter(a.oxygenLevel, 0.03)),
      digestScore: jitter(a.digestScore, 0.05),
    }
    try {
      const r = await fetch(`${baseUrl}/api/vitals`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ingest-key': ingestKey,
        },
        body: JSON.stringify(payload),
      })
      const body = await r.json().catch(() => null)
      if (r.status === 201) {
        console.log(
          `[${new Date().toLocaleTimeString()}] ${a.id} -> ${body?.analysis?.healthStatus} (conf ${body?.analysis?.confidence})`
        )
      } else {
        console.error(`ingest failed ${r.status}: ${body?.error ?? ''}`)
      }
    } catch (err) {
      console.error('ingest error:', err instanceof Error ? err.message : err)
    }
  }, 5000)
}

main()
