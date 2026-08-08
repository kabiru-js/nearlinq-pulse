import { getHealthMetrics, livestockData } from '@/lib/livestock-data'

/**
 * Frontend data layer for Nearling Pulse.
 *
 * NEXT_PUBLIC_DEMO_MODE=true renders from the built-in mock data
 * (lib/livestock-data.ts) so the dashboard works without a backend.
 * Otherwise it fetches from the API routes, whose response shapes mirror
 * the mock contract - so the UI code is identical in both modes.
 */

export type AnimalStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

export interface AnimalWithStatus {
  id: string
  name: string
  type: 'cow' | 'sheep' | 'goat' | 'pig'
  age: number | null
  weight: number | null
  location: string | null
  healthStatus: AnimalStatus
  confidence: number | null
  heartRate: number | null
  pulse: number | null
  temperature: number | null
  oxygenLevel: number | null
  digestScore: number | null
  lastCheckup: string | null
}

export interface HerdMetrics {
  total: number
  healthy: number
  warning: number
  critical: number
  avgHeartRate: number
  avgTemp: number
  avgOxygen: number
}

export interface DashboardMetrics extends HerdMetrics {
  healthPercentage: number
  updatedAt: string
}

export interface VitalReading {
  id: string
  animalId: string
  heartRate: number
  pulse: number
  temperatureC: number
  oxygenPct: number
  digestScore: number
  healthStatus: 'healthy' | 'warning' | 'critical'
  confidence: number
  recordedAt: string
}

export interface Checkup {
  id: string
  animalId: string
  performedBy: string | null
  weightKg: number | null
  notes: string | null
  /** Vet's assessment - the ML ground truth label. */
  verdict: 'healthy' | 'warning' | 'critical' | null
  performedAt: string
}

export interface AnimalDetail {
  animal: {
    id: string
    name: string
    type: string
    birthDate: string | null
    weightKg: number | null
    location: string | null
  }
  vitals: VitalReading[]
  checkups: Checkup[]
}

export interface CheckupInput {
  performedBy?: string
  weightKg?: number
  notes?: string
  verdict?: 'healthy' | 'warning' | 'critical'
}

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export const isDemoMode = DEMO_MODE

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

function demoAnimals(): AnimalWithStatus[] {
  return livestockData.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    age: a.age,
    weight: a.weight,
    location: a.location,
    healthStatus: a.healthStatus,
    confidence: null,
    heartRate: a.heartRate,
    pulse: a.pulse,
    temperature: a.temperature,
    oxygenLevel: a.oxygenLevel,
    digestScore: a.digestScore,
    lastCheckup: a.lastCheckup,
  }))
}

function demoDashboard(): DashboardMetrics {
  const m = getHealthMetrics()
  return {
    total: m.total,
    healthy: m.healthy,
    warning: m.warning,
    critical: m.critical,
    healthPercentage:
      m.total === 0 ? 0 : Math.round((m.healthy / m.total) * 100),
    avgHeartRate: m.avgHeartRate,
    avgTemp: Number(m.avgTemp),
    avgOxygen: m.avgOxygen,
    updatedAt: new Date().toISOString(),
  }
}

export async function fetchAnimals(): Promise<AnimalWithStatus[]> {
  if (DEMO_MODE) return demoAnimals()
  return fetchJson<AnimalWithStatus[]>('/api/animals')
}

interface DashboardApiResponse {
  total: number
  healthy: number
  warning: number
  critical: number
  healthPercentage: number
  avgHeartRate: number
  avgTemperature: number
  avgOxygen: number
  updatedAt: string
}

export async function fetchDashboard(): Promise<DashboardMetrics> {
  if (DEMO_MODE) return demoDashboard()
  const dash = await fetchJson<DashboardApiResponse>('/api/dashboard')
  return { ...dash, avgTemp: dash.avgTemperature }
}

export async function fetchAnimalDetail(id: string): Promise<AnimalDetail> {
  if (DEMO_MODE) {
    const detail = demoAnimalDetail(id)
    if (detail) return detail
    throw new Error('Animal not found')
  }
  return fetchJson<AnimalDetail>(`/api/animals/${id}`)
}

export async function createCheckup(
  animalId: string,
  input: CheckupInput
): Promise<Checkup> {
  const res = await fetch(`/api/animals/${animalId}/checkups`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

function demoAnimalDetail(id: string): AnimalDetail | null {
  const mock = livestockData.find((a) => a.id === id)
  const base = demoAnimals().find((a) => a.id === id)
  if (!mock || !base) return null
  return {
    animal: {
      id: base.id,
      name: base.name,
      type: base.type,
      birthDate: null,
      weightKg: base.weight,
      location: base.location,
    },
    vitals: [
      {
        id: 'demo',
        animalId: base.id,
        heartRate: mock.heartRate,
        pulse: mock.pulse,
        temperatureC: mock.temperature,
        oxygenPct: mock.oxygenLevel,
        digestScore: mock.digestScore,
        healthStatus: mock.healthStatus,
        confidence: 1,
        recordedAt: new Date(mock.lastCheckup).toISOString(),
      },
    ],
    checkups: [],
  }
}
