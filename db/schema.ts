import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** Shared secret that this org's sensor gateways send as X-Ingest-Key. */
  ingestKey: text('ingest_key').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const animals = pgTable('animals', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'cow' | 'sheep' | 'goat' | 'pig'
  birthDate: timestamp('birth_date', { withTimezone: true }),
  weightKg: numeric('weight_kg', { precision: 7, scale: 2 }),
  location: text('location'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const vitals = pgTable(
  'vitals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    animalId: uuid('animal_id')
      .notNull()
      .references(() => animals.id, { onDelete: 'cascade' }),
    heartRate: integer('heart_rate').notNull(),
    pulse: integer('pulse').notNull(),
    temperatureC: numeric('temperature_c', { precision: 4, scale: 1 }).notNull(),
    oxygenPct: integer('oxygen_pct').notNull(),
    digestScore: integer('digest_score').notNull(),
    // Output of the health analysis (your model, or the rule-based fallback)
    healthStatus: text('health_status').notNull(), // 'healthy' | 'warning' | 'critical'
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_vitals_animal_time').on(table.animalId, table.recordedAt)]
)

export const checkups = pgTable('checkups', {
  id: uuid('id').primaryKey().defaultRandom(),
  animalId: uuid('animal_id')
    .notNull()
    .references(() => animals.id, { onDelete: 'cascade' }),
  performedBy: text('performed_by'),
  weightKg: numeric('weight_kg', { precision: 7, scale: 2 }),
  notes: text('notes'),
  /** Vet's assessment: 'healthy' | 'warning' | 'critical' - the ML ground truth. */
  verdict: text('verdict'),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),
})

export const organizationsRelations = relations(organizations, ({ many }) => ({
  animals: many(animals),
  users: many(users),
}))

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}))

export const animalsRelations = relations(animals, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [animals.organizationId],
    references: [organizations.id],
  }),
  vitals: many(vitals),
  checkups: many(checkups),
}))

export const vitalsRelations = relations(vitals, ({ one }) => ({
  animal: one(animals, {
    fields: [vitals.animalId],
    references: [animals.id],
  }),
}))

export const checkupsRelations = relations(checkups, ({ one }) => ({
  animal: one(animals, {
    fields: [checkups.animalId],
    references: [animals.id],
  }),
}))

export type Organization = typeof organizations.$inferSelect
export type User = typeof users.$inferSelect
export type Animal = typeof animals.$inferSelect
export type Vitals = typeof vitals.$inferSelect
export type Checkup = typeof checkups.$inferSelect
