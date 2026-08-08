import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  console.warn(
    'DATABASE_URL is not set - falling back to the local docker-compose Postgres (postgres://nearling:nearling_dev@localhost:5432/nearling).'
  )
}

const client = postgres(
  process.env.DATABASE_URL ??
    'postgres://nearling:nearling_dev@localhost:5432/nearling',
  {
    max: 1,
    prepare: false,
  }
)

export const db = drizzle(client, { schema })
export type DB = typeof db
export * from './schema'
