import { describe, expect, it } from 'vitest'
import { RULE_THRESHOLDS, ruleBasedAnalyze } from '@/lib/model/rule-based'

const base = {
  animalId: 'animal-1',
  heartRate: 70,
  pulse: 72,
  temperatureC: 38.2,
  oxygenPct: 98,
  digestScore: 92,
  recordedAt: '2026-08-06T00:00:00.000Z',
}

describe('ruleBasedAnalyze', () => {
  it('classifies normal vitals as healthy', () => {
    const out = ruleBasedAnalyze(base)
    expect(out.healthStatus).toBe('healthy')
    expect(out.reasons).toEqual([])
  })

  it('flags elevated temperature as warning', () => {
    const out = ruleBasedAnalyze({ ...base, temperatureC: 39.3 })
    expect(out.healthStatus).toBe('warning')
    expect(out.reasons?.some((r) => r.includes('temperature'))).toBe(true)
  })

  it('flags critical temperature', () => {
    const out = ruleBasedAnalyze({ ...base, temperatureC: 39.9 })
    expect(out.healthStatus).toBe('critical')
  })

  it('flags elevated heart rate as warning', () => {
    const out = ruleBasedAnalyze({ ...base, heartRate: 86 })
    expect(out.healthStatus).toBe('warning')
  })

  it('flags critical heart rate', () => {
    const out = ruleBasedAnalyze({ ...base, heartRate: 101 })
    expect(out.healthStatus).toBe('critical')
  })

  it('flags low oxygen as warning', () => {
    const out = ruleBasedAnalyze({ ...base, oxygenPct: 94 })
    expect(out.healthStatus).toBe('warning')
  })

  it('flags critical oxygen', () => {
    const out = ruleBasedAnalyze({ ...base, oxygenPct: 89 })
    expect(out.healthStatus).toBe('critical')
  })

  it('flags low digest score as warning', () => {
    const out = ruleBasedAnalyze({ ...base, digestScore: 75 })
    expect(out.healthStatus).toBe('warning')
  })

  it('critical wins over warning', () => {
    const out = ruleBasedAnalyze({ ...base, temperatureC: 39.3, heartRate: 101 })
    expect(out.healthStatus).toBe('critical')
  })

  it('uses boundary values exactly', () => {
    // warning thresholds are inclusive
    expect(ruleBasedAnalyze({ ...base, temperatureC: RULE_THRESHOLDS.warningTemperatureC }).healthStatus).toBe('warning')
    expect(ruleBasedAnalyze({ ...base, heartRate: RULE_THRESHOLDS.warningHeartRate }).healthStatus).toBe('warning')
    expect(ruleBasedAnalyze({ ...base, oxygenPct: RULE_THRESHOLDS.warningOxygenPct }).healthStatus).toBe('warning')
    // below warning threshold stays healthy
    expect(ruleBasedAnalyze({ ...base, temperatureC: RULE_THRESHOLDS.warningTemperatureC - 0.1 }).healthStatus).toBe('healthy')
  })
})
