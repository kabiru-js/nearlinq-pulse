import { z } from 'zod'
import { HEALTH_STATUSES, type ModelInput, type ModelOutput } from './types'

const modelOutputSchema = z.object({
  healthStatus: z.enum(HEALTH_STATUSES),
  confidence: z.number().min(0).max(1),
  score: z.number().optional(),
  reasons: z.array(z.string()).optional(),
})

export class ModelClientError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'ModelClientError'
  }
}

/**
 * Calls your trained model server (POST {MODEL_API_URL}/predict).
 * The server must return a body matching `ModelOutput` - see docs/MODEL_CONTRACT.md.
 */
export async function httpModelAnalyze(input: ModelInput): Promise<ModelOutput> {
  const baseUrl = process.env.MODEL_API_URL
  if (!baseUrl) throw new ModelClientError('MODEL_API_URL is not configured')

  const timeoutMs = Number(process.env.MODEL_TIMEOUT_MS ?? 3000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new ModelClientError(`model server responded with ${res.status}`, res.status)
    }
    const parsed = modelOutputSchema.safeParse(await res.json())
    if (!parsed.success) {
      throw new ModelClientError(
        `model output failed validation: ${parsed.error.message}`
      )
    }
    return parsed.data
  } catch (err) {
    if (err instanceof ModelClientError) throw err
    throw new ModelClientError(
      `model request failed: ${err instanceof Error ? err.message : String(err)}`
    )
  } finally {
    clearTimeout(timer)
  }
}
