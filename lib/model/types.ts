export const HEALTH_STATUSES = ['healthy', 'warning', 'critical'] as const
export type HealthStatus = (typeof HEALTH_STATUSES)[number]

/**
 * Input contract for health analysis - one vital reading.
 * This is what your trained model server receives in POST /predict.
 * The field names deliberately mirror the sensor payload.
 */
export interface ModelInput {
  animalId: string
  heartRate: number
  pulse: number
  temperatureC: number
  oxygenPct: number
  digestScore: number
  recordedAt: string
}

/**
 * Output contract for health analysis.
 * Your model server must return this shape (or a superset) from POST /predict.
 */
export interface ModelOutput {
  healthStatus: HealthStatus
  /** 0..1 - how confident the model is in the prediction */
  confidence: number
  /** Optional 0..100 health score (mirrors the dashboard's gauge) */
  score?: number
  /** Optional human-readable reasons, shown to the farmer */
  reasons?: string[]
}
