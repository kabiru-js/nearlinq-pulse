import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { organizations, users, animals, vitals } from '../db/schema'
import { livestockData } from '../lib/livestock-data'
import { ruleBasedAnalyze } from '../lib/model'

/**
 * Seeds the database: demo organization (with its ingest key), demo user,
 * and the original mock animals with initial vitals.
 *
 * Usage: pnpm seed
 * Requires DATABASE_URL (see .env.example / docker-compose.yml).
 */
async function main() {
  const orgName = process.env.SEED_ORG ?? 'Demo Farm'
  const ingestKey = process.env.VITALS_INGEST_KEY ?? 'change-me'
  const demoEmail = process.env.SEED_EMAIL ?? 'demo@nearling.dev'
  const demoPassword = process.env.SEED_PASSWORD ?? 'demo1234'

  let org = (await db.select().from(organizations).where(eq(organizations.name, orgName)))[0]
  if (!org) {
    const [created] = await db
      .insert(organizations)
      .values({ name: orgName })
      .returning()
    org = created
    console.log(`Created organization "${orgName}"`)
  }

  // Keep the org's ingest key in sync with the env so the simulator always works.
  if (org.ingestKey !== ingestKey) {
    const [updated] = await db
      .update(organizations)
      .set({ ingestKey })
      .where(eq(organizations.id, org.id))
      .returning()
    org = updated
  }

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, demoEmail))
    .limit(1)
  if (existingUser.length === 0) {
    await db.insert(users).values({
      organizationId: org.id,
      email: demoEmail,
      name: 'Demo Farmer',
      passwordHash: bcrypt.hashSync(demoPassword, 10),
    })
    console.log(`Created demo user ${demoEmail} (password: ${demoPassword})`)
  }

  let inserted = 0
  for (const mock of livestockData) {
    const existing = await db
      .select({ id: animals.id })
      .from(animals)
      .where(eq(animals.name, mock.name))
      .limit(1)
    if (existing.length > 0) continue

    const [animal] = await db
      .insert(animals)
      .values({
        organizationId: org.id,
        name: mock.name,
        type: mock.type,
        birthDate: new Date(Date.now() - mock.age * 365 * 24 * 60 * 60 * 1000),
        weightKg: String(mock.weight),
        location: mock.location,
      })
      .returning()

    // Deterministic baseline analysis for the seed reading.
    // Once your model is live, the ingestion API will use it instead.
    const analysis = ruleBasedAnalyze({
      animalId: animal.id,
      heartRate: mock.heartRate,
      pulse: mock.pulse,
      temperatureC: mock.temperature,
      oxygenPct: mock.oxygenLevel,
      digestScore: mock.digestScore,
      recordedAt: new Date().toISOString(),
    })

    await db.insert(vitals).values({
      animalId: animal.id,
      heartRate: mock.heartRate,
      pulse: mock.pulse,
      temperatureC: String(mock.temperature),
      oxygenPct: mock.oxygenLevel,
      digestScore: mock.digestScore,
      healthStatus: analysis.healthStatus,
      confidence: String(analysis.confidence),
      ...(mock.lastCheckup ? { recordedAt: new Date(mock.lastCheckup) } : {}),
    })
    inserted++
  }

  console.log(
    `Seeded ${inserted} animal(s) under "${orgName}". Ingest key: ${ingestKey}`
  )
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
