import { httpModelAnalyze } from './http'
import { ruleBasedAnalyze } from './rule-based'
import type { ModelInput, ModelOutput } from './types'

/**
 * Single entry point for health analysis - the backend never talks to the
 * model directly, only through here.
 *
 * - With MODEL_API_URL set: every reading is analyzed by YOUR trained model.
 * - Without it (or on failure in fallback mode): deterministic rules are used,
 *   so the system stays functional before the model is wired up.
 */
export async function analyzeVitals(input: ModelInput): Promise<ModelOutput> {
  if (process.env.MODEL_API_URL) {
    try {
      return await httpModelAnalyze(input)
    } catch (err) {
      if (process.env.MODEL_FALLBACK_MODE === 'strict') throw err
      console.warn(
        '[model] falling back to rule-based analysis:',
        err instanceof Error ? err.message : err
      )
    }
  }
  return ruleBasedAnalyze(input)
}

export { ruleBasedAnalyze } from './rule-based'
export type { HealthStatus, ModelInput, ModelOutput } from './types'
export { ModelClientError } from './http'
