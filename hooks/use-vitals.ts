'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchAnimals,
  fetchDashboard,
  isDemoMode,
  type AnimalWithStatus,
  type DashboardMetrics,
} from '@/lib/api'

export type RealtimeMode = 'polling' | 'sse'

interface UseVitalsOptions {
  /** How often to re-fetch in polling mode (ms). Default 10s. */
  intervalMs?: number
  /**
   * 'polling' (default) - re-fetch on an interval. Works everywhere.
   * 'sse' - EventSource on /api/stream pushes on new readings, with a
   *         30s heartbeat as a fallback in case the stream drops.
   */
  realtime?: RealtimeMode
}

export interface UseVitalsResult {
  animals: AnimalWithStatus[]
  metrics: DashboardMetrics | null
  /** True only until the first successful load. */
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  /** False when no successful fetch has happened in the freshness window. */
  isFresh: boolean
  /** Animal ids whose latest reading changed since the previous fetch. */
  changedIds: string[]
  refresh: () => void
}

const DEMO_MODE = isDemoMode

/** How long after a successful fetch the data is considered fresh (ms). */
const FRESH_WINDOW_MS = 35000

function animalKey(a: AnimalWithStatus) {
  return `${a.lastCheckup ?? ''}|${a.healthStatus}|${a.heartRate ?? ''}|${a.temperature ?? ''}|${a.oxygenLevel ?? ''}`
}

export function useVitals({
  intervalMs = 10000,
  realtime = 'polling',
}: UseVitalsOptions = {}): UseVitalsResult {
  const [animals, setAnimals] = useState<AnimalWithStatus[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [changedIds, setChangedIds] = useState<string[]>([])
  const [isFresh, setIsFresh] = useState(false)
  const [tick, setTick] = useState(0)

  const prevKeysRef = useRef<Map<string, string> | null>(null)
  const clearChangedRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  // Load data on mount, manual refresh, or push-triggered refresh.
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [animalList, dash] = await Promise.all([
          fetchAnimals(),
          fetchDashboard(),
        ])
        if (cancelled) return

        // Detect which animals changed vs. the previous fetch, so the UI
        // can flash the updated cards (skipped on the very first load).
        const nextKeys = new Map(animalList.map((a) => [a.id, animalKey(a)]))
        const prev = prevKeysRef.current
        if (prev) {
          const changed = animalList
            .filter((a) => prev.has(a.id) && prev.get(a.id) !== nextKeys.get(a.id))
            .map((a) => a.id)
          if (changed.length > 0) {
            setChangedIds(changed)
            if (clearChangedRef.current) clearTimeout(clearChangedRef.current)
            clearChangedRef.current = setTimeout(() => setChangedIds([]), 2500)
          }
        }
        prevKeysRef.current = nextKeys

        setAnimals(animalList)
        setMetrics(dash)
        setLastUpdated(new Date())
        setIsFresh(true)
        if (staleTimerRef.current) clearTimeout(staleTimerRef.current)
        staleTimerRef.current = setTimeout(() => setIsFresh(false), FRESH_WINDOW_MS)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [tick])

  // Polling loop - skipped in demo mode (mock data never changes).
  useEffect(() => {
    if (DEMO_MODE || realtime === 'sse') return
    const id = setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [realtime, intervalMs])

  // SSE transport - push triggers an immediate refresh; a 30s heartbeat
  // guards against silently dropped connections.
  useEffect(() => {
    if (DEMO_MODE || realtime !== 'sse') return

    const es = new EventSource('/api/stream')
    const onVitals = () => setTick((t) => t + 1)
    es.addEventListener('vitals', onVitals)
    const heartbeat = setInterval(() => setTick((t) => t + 1), 30000)

    return () => {
      es.removeEventListener('vitals', onVitals)
      es.close()
      clearInterval(heartbeat)
    }
  }, [realtime])

  // Clear the staleness timer on unmount.
  useEffect(() => {
    return () => {
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current)
      if (clearChangedRef.current) clearTimeout(clearChangedRef.current)
    }
  }, [])

  return { animals, metrics, loading, error, lastUpdated, isFresh, changedIds, refresh }
}
