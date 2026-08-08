import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModelClientError, httpModelAnalyze } from '@/lib/model/http'

const input = {
  animalId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  heartRate: 70,
  pulse: 72,
  temperatureC: 38.2,
  oxygenPct: 98,
  digestScore: 92,
  recordedAt: '2026-08-06T00:00:00.000Z',
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.MODEL_API_URL
  delete process.env.MODEL_TIMEOUT_MS
})

function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  )
}

describe('httpModelAnalyze', () => {
  it('returns the model verdict when the output is valid', async () => {
    process.env.MODEL_API_URL = 'http://model:8000'
    stubFetch({ healthStatus: 'warning', confidence: 0.83, reasons: ['elevated temp'] })

    const out = await httpModelAnalyze(input)
    expect(out).toEqual({
      healthStatus: 'warning',
      confidence: 0.83,
      reasons: ['elevated temp'],
    })
    expect(fetch).toHaveBeenCalledWith(
      'http://model:8000/predict',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws when the model output fails validation', async () => {
    process.env.MODEL_API_URL = 'http://model:8000'
    stubFetch({ healthStatus: 'maybe', confidence: 2 })

    await expect(httpModelAnalyze(input)).rejects.toBeInstanceOf(ModelClientError)
  })

  it('throws when the model server responds with an error', async () => {
    process.env.MODEL_API_URL = 'http://model:8000'
    stubFetch({ detail: 'no model loaded' }, 501)

    await expect(httpModelAnalyze(input)).rejects.toThrow('501')
  })

  it('throws when MODEL_API_URL is not configured', async () => {
    delete process.env.MODEL_API_URL
    await expect(httpModelAnalyze(input)).rejects.toThrow('not configured')
  })
})
