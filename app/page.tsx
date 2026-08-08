'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimalCard } from '@/components/animal-card'
import { AnimalDetailModal } from '@/components/animal-detail-modal'
import { HerdHealthOverview } from '@/components/herd-health-overview'
import { Filter, LogOut } from 'lucide-react'
import { useVitals, type RealtimeMode } from '@/hooks/use-vitals'
import { isDemoMode, type AnimalWithStatus } from '@/lib/api'

type FilterType = 'all' | 'healthy' | 'warning' | 'critical'

function SkeletonOverview() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-64 bg-gray-200 rounded animate-pulse" />
      <div className="h-40 bg-gray-200 rounded-xl animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}

export default function Page() {
  const router = useRouter()
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalWithStatus | null>(
    null
  )
  const [filter, setFilter] = useState<FilterType>('all')

  const realtime: RealtimeMode =
    process.env.NEXT_PUBLIC_REALTIME === 'sse' ? 'sse' : 'polling'
  const { animals, metrics, loading, error, lastUpdated, changedIds, refresh, isFresh } =
    useVitals({ realtime })

  const filteredAnimals =
    filter === 'all'
      ? animals
      : animals.filter((animal) => animal.healthStatus === filter)

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Nearling Pulse
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Livestock Health Monitoring System
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-700">
                Total Animals: {metrics ? metrics.total : '—'}
              </p>
              <p className="text-xs text-gray-500 flex items-center justify-end gap-1.5">
                {loading ? (
                  'Loading…'
                ) : lastUpdated ? (
                  <>
                    <span
                      className={`w-2 h-2 rounded-full ${isFresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
                    />
                    Updated {lastUpdated.toLocaleTimeString()}
                  </>
                ) : (
                  'Data unavailable'
                )}
              </p>
              {!isDemoMode && (
                <button
                  onClick={handleSignOut}
                  className="mt-1 text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Herd Health Overview */}
        <section className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
          {metrics ? (
            <HerdHealthOverview metrics={metrics} />
          ) : loading ? (
            <SkeletonOverview />
          ) : null}
        </section>

        {/* Individual Animals Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Individual Animals</h2>
              <p className="text-gray-600 text-sm mt-1">
                Tap on any animal to view detailed health metrics
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'healthy', 'warning', 'critical'] as FilterType[]).map(
              (filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filter === filterType
                      ? filterType === 'all'
                        ? 'bg-blue-500 text-white'
                        : filterType === 'healthy'
                          ? 'bg-green-500 text-white'
                          : filterType === 'warning'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-red-500 text-white'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {filterType === 'all'
                    ? 'All'
                    : filterType === 'healthy'
                      ? 'Healthy'
                      : filterType === 'warning'
                        ? 'Warning'
                        : 'Critical'}
                </button>
              )
            )}
          </div>

          {error && animals.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow">
              <p className="text-red-600 font-semibold mb-2">
                Could not load data
              </p>
              <p className="text-gray-500 text-sm mb-4">{error}</p>
              <button
                onClick={refresh}
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold transition"
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-56 bg-gray-200 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : animals.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow">
              <p className="text-gray-500 text-lg">
                No animals in the database yet.
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Run `pnpm seed`, or set NEXT_PUBLIC_DEMO_MODE=true to browse
                demo data.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAnimals.map((animal) => (
                <AnimalCard
                  key={animal.id}
                  animal={animal}
                  onClick={setSelectedAnimal}
                  highlight={changedIds.includes(animal.id)}
                />
              ))}
            </div>
          )}

          {!loading && !error && animals.length > 0 && filteredAnimals.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No animals found with {filter} status
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Animal Detail Modal - keyed by animal so transient state resets per animal */}
      <AnimalDetailModal
        key={selectedAnimal?.id ?? 'closed'}
        animal={selectedAnimal}
        isOpen={selectedAnimal !== null}
        onClose={() => setSelectedAnimal(null)}
        onCheckupRecorded={refresh}
      />
    </main>
  )
}
