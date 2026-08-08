'use client'

import { useState } from 'react'
import type { AnimalWithStatus } from '@/lib/api'
import { CheckupForm } from '@/components/checkup-form'
import { VitalsHistory } from '@/components/vitals-history'
import {
  X,
  Heart,
  Thermometer,
  Wind,
  Zap,
  MapPin,
  Calendar,
  History,
  ClipboardPlus,
  ArrowLeft,
} from 'lucide-react'

interface AnimalDetailModalProps {
  animal: AnimalWithStatus | null
  isOpen: boolean
  onClose: () => void
  /** Called after a check-up is recorded, so the dashboard can refresh. */
  onCheckupRecorded?: () => void
}

export function AnimalDetailModal({
  animal,
  isOpen,
  onClose,
  onCheckupRecorded,
}: AnimalDetailModalProps) {
  const [view, setView] = useState<'details' | 'history'>('details')
  const [showForm, setShowForm] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)

  if (!isOpen || !animal) return null

  const healthPercentage =
    animal.healthStatus === 'healthy'
      ? 95
      : animal.healthStatus === 'warning'
        ? 70
        : animal.healthStatus === 'critical'
          ? 40
          : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-center">
        {/* Header */}
        <div
          className={`sticky top-0 p-6 border-b ${animal.healthStatus === 'healthy' ? 'bg-green-50 border-green-200' : animal.healthStatus === 'warning' ? 'bg-yellow-50 border-yellow-200' : animal.healthStatus === 'critical' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-1">{animal.name}</h2>
              <p className="text-gray-600">{animal.id}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {view === 'history' ? (
            <VitalsHistory animalId={animal.id} refreshKey={historyKey} />
          ) : (
            <>
              {/* Large SVG Visualization */}
              <div className="flex justify-center p-6 bg-gray-50 rounded-lg">
                {animal.type === 'cow' && (
                  <svg
                    className="w-32 h-32"
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" />
                    <circle cx="35" cy="35" r="5" fill="currentColor" />
                    <circle cx="65" cy="35" r="5" fill="currentColor" />
                    <ellipse cx="50" cy="60" rx="8" ry="12" stroke="currentColor" strokeWidth="2" />
                    <line x1="30" y1="85" x2="30" y2="95" stroke="currentColor" strokeWidth="2" />
                    <line x1="70" y1="85" x2="70" y2="95" stroke="currentColor" strokeWidth="2" />
                    <path
                      d="M 25 40 Q 15 40 15 50"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M 75 40 Q 85 40 85 50"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                )}
                {animal.type === 'sheep' && (
                  <svg
                    className="w-32 h-32"
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="50" cy="45" r="30" stroke="currentColor" strokeWidth="2" />
                    <circle cx="50" cy="45" r="25" fill="currentColor" opacity="0.3" />
                    <circle cx="40" cy="35" r="3" fill="currentColor" />
                    <circle cx="60" cy="35" r="3" fill="currentColor" />
                    <ellipse cx="50" cy="50" rx="5" ry="8" fill="currentColor" />
                    <line x1="35" y1="80" x2="35" y2="95" stroke="currentColor" strokeWidth="2" />
                    <line x1="65" y1="80" x2="65" y2="95" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </div>

              {/* Health Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Overall Health</span>
                  <span
                    className={`text-lg font-bold ${animal.healthStatus === 'healthy' ? 'text-green-700' : animal.healthStatus === 'warning' ? 'text-yellow-700' : animal.healthStatus === 'critical' ? 'text-red-700' : 'text-gray-700'}`}
                  >
                    {animal.healthStatus === 'healthy'
                      ? 'Healthy'
                      : animal.healthStatus === 'warning'
                        ? 'Warning'
                        : animal.healthStatus === 'critical'
                          ? 'Critical'
                          : 'No data'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${animal.healthStatus === 'healthy' ? 'bg-green-500' : animal.healthStatus === 'warning' ? 'bg-yellow-500' : animal.healthStatus === 'critical' ? 'bg-red-500' : 'bg-gray-400'}`}
                    style={{ width: `${healthPercentage}%` }}
                  />
                </div>
              </div>

              {/* Vital Signs Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-semibold text-gray-700">Heart Rate</span>
                  </div>
                  <p className="text-3xl font-bold text-red-600">{animal.heartRate ?? '—'}</p>
                  <p className="text-xs text-gray-500 mt-1">bpm</p>
                </div>

                <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-pink-500" />
                    <span className="text-sm font-semibold text-gray-700">Pulse</span>
                  </div>
                  <p className="text-3xl font-bold text-pink-600">{animal.pulse ?? '—'}</p>
                  <p className="text-xs text-gray-500 mt-1">beats/min</p>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="w-5 h-5 text-orange-500" />
                    <span className="text-sm font-semibold text-gray-700">Temperature</span>
                  </div>
                  <p className="text-3xl font-bold text-orange-600">{animal.temperature ?? '—'}</p>
                  <p className="text-xs text-gray-500 mt-1">°C</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wind className="w-5 h-5 text-blue-500" />
                    <span className="text-sm font-semibold text-gray-700">O₂ Level</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{animal.oxygenLevel ?? '—'}%</p>
                  <p className="text-xs text-gray-500 mt-1">oxygen saturation</p>
                </div>
              </div>

              {/* Additional Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Digestive Score</p>
                  <p className="text-2xl font-bold">
                    {animal.digestScore != null ? `${animal.digestScore}/100` : '—'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Weight</p>
                  <p className="text-2xl font-bold">
                    {animal.weight != null ? `${animal.weight} kg` : '—'}
                  </p>
                </div>
              </div>

              {/* Info Section */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="font-semibold">{animal.location ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Last Checkup</p>
                    <p className="font-semibold">
                      {animal.lastCheckup
                        ? new Date(animal.lastCheckup).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-4 border-t">
            <div className="grid grid-cols-2 gap-3">
              {view === 'details' ? (
                <>
                  <button
                    onClick={() => setShowForm((s) => !s)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <ClipboardPlus className="w-4 h-4" />
                      Record Check-up
                    </span>
                  </button>
                  <button
                    onClick={() => setView('history')}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <History className="w-4 h-4" />
                      View History
                    </span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setView('details')}
                  className="col-span-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition"
                >
                  <span className="flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to details
                  </span>
                </button>
              )}
            </div>

            {view === 'details' && showForm && (
              <CheckupForm
                animalId={animal.id}
                onCancel={() => setShowForm(false)}
                onRecorded={() => {
                  setHistoryKey((key) => key + 1)
                  onCheckupRecorded?.()
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
