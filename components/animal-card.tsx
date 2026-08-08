'use client'

import type { AnimalWithStatus } from '@/lib/api'
import { Heart, Droplet } from 'lucide-react'

interface AnimalCardProps {
  animal: AnimalWithStatus
  onClick: (animal: AnimalWithStatus) => void
  /** Flash the card to draw attention after its reading changed. */
  highlight?: boolean
}

export function AnimalCard({ animal, onClick, highlight = false }: AnimalCardProps) {
  const statusBgColor =
    animal.healthStatus === 'healthy'
      ? 'border-green-500 hover:bg-green-50'
      : animal.healthStatus === 'warning'
        ? 'border-yellow-500 hover:bg-yellow-50'
        : animal.healthStatus === 'critical'
          ? 'border-red-500 hover:bg-red-50'
          : 'border-gray-400 hover:bg-gray-50'

  return (
    <button
      onClick={() => onClick(animal)}
      className={`border-2 rounded-lg p-4 text-left transition-all ${statusBgColor} bg-white cursor-pointer ${highlight ? 'ring-2 ring-blue-400/80' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg">{animal.name}</h3>
          <p className="text-sm text-gray-500">{animal.id}</p>
        </div>
        <div
          className={`w-3 h-3 rounded-full ${animal.healthStatus === 'healthy' ? 'bg-green-500' : animal.healthStatus === 'warning' ? 'bg-yellow-500' : animal.healthStatus === 'critical' ? 'bg-red-500' : 'bg-gray-400'}`}
        />
      </div>

      {/* SVG Animal Icon */}
      <div className="mb-3 flex justify-center">
        {animal.type === 'cow' && (
          <svg
            className="w-12 h-12"
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
            className="w-12 h-12"
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

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Heart Rate</span>
          <div className="flex items-center gap-1">
            <Heart className="w-4 h-4 text-red-500" />
            <span className="font-semibold">{animal.heartRate ?? '—'}</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Temperature</span>
          <span className="font-semibold">
            {animal.temperature != null ? `${animal.temperature}°C` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">O₂ Level</span>
          <div className="flex items-center gap-1">
            <Droplet className="w-4 h-4 text-blue-500" />
            <span className="font-semibold">{animal.oxygenLevel ?? '—'}%</span>
          </div>
        </div>
        <div className="pt-2 border-t">
          <p
            className={`text-sm font-semibold ${animal.healthStatus === 'healthy' ? 'text-green-700' : animal.healthStatus === 'warning' ? 'text-yellow-700' : animal.healthStatus === 'critical' ? 'text-red-700' : 'text-gray-600'}`}
          >
            {animal.healthStatus === 'healthy'
              ? 'Healthy'
              : animal.healthStatus === 'warning'
                ? 'Warning'
                : animal.healthStatus === 'critical'
                  ? 'Critical'
                  : 'No data'}
          </p>
        </div>
      </div>
    </button>
  )
}
