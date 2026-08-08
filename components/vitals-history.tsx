'use client'

import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchAnimalDetail, type AnimalDetail } from '@/lib/api'

interface VitalsHistoryProps {
  animalId: string
  /** Increment to force a refetch (e.g. after a check-up is recorded). */
  refreshKey?: number
}

interface ChartPoint {
  time: string
  heartRate: number
  temperatureC: number
  oxygenPct: number
  digestScore: number
}

const CHARTS: {
  key: keyof Omit<ChartPoint, 'time'>
  color: string
  unit: string
  label: string
}[] = [
  { key: 'heartRate', color: '#ef4444', unit: 'bpm', label: 'Heart Rate' },
  { key: 'temperatureC', color: '#f97316', unit: '°C', label: 'Temperature' },
  { key: 'oxygenPct', color: '#3b82f6', unit: '%', label: 'O₂ Level' },
  { key: 'digestScore', color: '#10b981', unit: '/100', label: 'Digest Score' },
]

export function VitalsHistory({ animalId, refreshKey = 0 }: VitalsHistoryProps) {
  const [detail, setDetail] = useState<AnimalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const d = await fetchAnimalDetail(animalId)
        if (cancelled) return
        setDetail(d)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load history')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [animalId, refreshKey])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-44 bg-gray-200 rounded animate-pulse" />
        <div className="h-52 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 font-semibold mb-1">Could not load history</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    )
  }

  if (!detail) return null

  // API returns newest-first; charts read better oldest -> newest.
  const chartData: ChartPoint[] = [...detail.vitals]
    .reverse()
    .map((v) => ({
      time: new Date(v.recordedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      heartRate: v.heartRate,
      temperatureC: v.temperatureC,
      oxygenPct: v.oxygenPct,
      digestScore: v.digestScore,
    }))

  const latest = detail.vitals[0]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">Vitals History</h3>
        <p className="text-xs text-gray-500 mb-3">
          {detail.vitals.length} reading
          {detail.vitals.length === 1 ? '' : 's'}
          {latest ? ` · latest ${new Date(latest.recordedAt).toLocaleString()}` : ''}
        </p>
        {chartData.length === 0 ? (
          <p className="text-gray-500 text-sm">No readings recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CHARTS.map((c) => (
              <div key={c.key} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 mb-2">
                  {c.label} ({c.unit})
                </p>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 4, right: 8, bottom: 0, left: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        minTickGap={24}
                      />
                      <YAxis tick={{ fontSize: 10 }} width={30} domain={['auto', 'auto']} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey={c.key}
                        stroke={c.color}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Check-up Log</h3>
        {detail.checkups.length === 0 ? (
          <p className="text-gray-500 text-sm">No check-ups recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {detail.checkups.map((c) => (
              <li key={c.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">
                    {new Date(c.performedAt).toLocaleDateString([], {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    {c.verdict && (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          c.verdict === 'healthy'
                            ? 'bg-green-100 text-green-700'
                            : c.verdict === 'warning'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {c.verdict === 'healthy'
                          ? 'Healthy'
                          : c.verdict === 'warning'
                            ? 'Warning'
                            : 'Critical'}
                      </span>
                    )}
                    {c.weightKg != null && (
                      <p className="text-sm font-semibold text-gray-700">
                        {c.weightKg} kg
                      </p>
                    )}
                  </div>
                </div>
                {c.performedBy && (
                  <p className="text-xs text-gray-500">by {c.performedBy}</p>
                )}
                {c.notes && <p className="text-sm text-gray-700 mt-2">{c.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
