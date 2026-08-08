import type { HealthStatus, ModelInput, ModelOutput } from './types'

/**
 * Deterministic baseline thresholds - used until a trained model is configured.
 * Critical flags win over warning flags.
 */
export const RULE_THRESHOLDS = {
  criticalTemperatureC: 39.8,
  warningTemperatureC: 39.2,
  criticalHeartRate: 100,
  warningHeartRate: 85,
  criticalOxygenPct: 90,
  warningOxygenPct: 95,
  criticalDigestScore: 60,
  warningDigestScore: 80,
} as const

export function ruleBasedAnalyze(input: ModelInput): ModelOutput {
  const reasons: string[] = []
  let healthStatus: HealthStatus = 'healthy'

  const flag = (level: 'warning' | 'critical', condition: boolean, reason: string) => {
    if (!condition) return
    if (level === 'critical') {
      healthStatus = 'critical'
    } else if (healthStatus !== 'critical') {
      healthStatus = 'warning'
    }
    reasons.push(reason)
  }

  const t = RULE_THRESHOLDS
  flag(
    'critical',
    input.temperatureC >= t.criticalTemperatureC,
    `temperature ${input.temperatureC}C is critical`
  )
  flag(
    'warning',
    input.temperatureC >= t.warningTemperatureC,
    `temperature ${input.temperatureC}C is elevated`
  )
  flag(
    'critical',
    input.heartRate >= t.criticalHeartRate,
    `heart rate ${input.heartRate} bpm is critical`
  )
  flag(
    'warning',
    input.heartRate >= t.warningHeartRate,
    `heart rate ${input.heartRate} bpm is elevated`
  )
  flag(
    'critical',
    input.oxygenPct <= t.criticalOxygenPct,
    `oxygen ${input.oxygenPct}% is critical`
  )
  flag(
    'warning',
    input.oxygenPct <= t.warningOxygenPct,
    `oxygen ${input.oxygenPct}% is low`
  )
  flag(
    'critical',
    input.digestScore <= t.criticalDigestScore,
    `digest score ${input.digestScore} is critical`
  )
  flag(
    'warning',
    input.digestScore <= t.warningDigestScore,
    `digest score ${input.digestScore} is low`
  )

  const confidence =
    healthStatus === 'healthy' ? 0.9 : healthStatus === 'warning' ? 0.8 : 0.7
  const score = healthStatus === 'healthy' ? 90 : healthStatus === 'warning' ? 70 : 40

  return { healthStatus, confidence, score, reasons }
}
