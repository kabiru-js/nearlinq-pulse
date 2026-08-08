import { z } from 'zod'

export const vitalsIngestSchema = z.object({
  animalId: z.string().uuid(),
  heartRate: z.number().int().min(20).max(250),
  pulse: z.number().int().min(20).max(250),
  temperatureC: z.number().min(30).max(45),
  oxygenPct: z.number().int().min(50).max(100),
  digestScore: z.number().int().min(0).max(100),
  recordedAt: z.string().datetime().optional(),
})

export type VitalsIngestInput = z.infer<typeof vitalsIngestSchema>

export const checkupSchema = z.object({
  performedBy: z.string().max(120).optional(),
  weightKg: z.number().positive().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  verdict: z.enum(['healthy', 'warning', 'critical']).optional(),
})

export type CheckupInput = z.infer<typeof checkupSchema>

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>
