'use client'

import { Heart, Thermometer, Wind, AlertCircle } from 'lucide-react'
import type { HerdMetrics } from '@/lib/api'

export function HerdHealthOverview({ metrics }: { metrics: HerdMetrics }) {
  const healthPercentage =
    metrics.total === 0 ? 0 : Math.round((metrics.healthy / metrics.total) * 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Collective Herd Health</h2>
        <p className="text-gray-600">Real-time monitoring of all livestock</p>
      </div>

      {/* Main Health Gauge */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600 mb-2">Overall Herd Status</p>
            <div className="text-5xl font-bold text-green-600 mb-3">{healthPercentage}%</div>
            <p className="text-green-700 font-semibold">{metrics.healthy} of {metrics.total} animals healthy</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="8"
                  strokeDasharray={`${(healthPercentage / 100) * 282.7} 282.7`}
                  strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-green-600">{healthPercentage}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Healthy</p>
          <p className="text-4xl font-bold text-green-600">{metrics.healthy}</p>
          <p className="text-xs text-green-600 mt-2">
            {Math.round((metrics.healthy / metrics.total) * 100)}% of herd
          </p>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Warning</p>
          <p className="text-4xl font-bold text-yellow-600">{metrics.warning}</p>
          <p className="text-xs text-yellow-600 mt-2">
            {Math.round((metrics.warning / metrics.total) * 100)}% of herd
          </p>
        </div>

        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Critical</p>
          <p className="text-4xl font-bold text-red-600">{metrics.critical}</p>
          <p className="text-xs text-red-600 mt-2">
            {Math.round((metrics.critical / metrics.total) * 100)}% of herd
          </p>
        </div>
      </div>

      {/* Average Vitals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <Heart className="w-5 h-5 text-red-500" />
            <span className="font-semibold">Avg Heart Rate</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{metrics.avgHeartRate}</p>
          <p className="text-xs text-gray-500 mt-2">beats per minute</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <Thermometer className="w-5 h-5 text-orange-500" />
            <span className="font-semibold">Avg Temperature</span>
          </div>
          <p className="text-3xl font-bold text-orange-600">{metrics.avgTemp}</p>
          <p className="text-xs text-gray-500 mt-2">degrees celsius</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <Wind className="w-5 h-5 text-blue-500" />
            <span className="font-semibold">Avg O₂ Level</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{metrics.avgOxygen}%</p>
          <p className="text-xs text-gray-500 mt-2">oxygen saturation</p>
        </div>
      </div>

      {/* Alerts Summary */}
      {metrics.critical > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex gap-4">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900 mb-1">
              {metrics.critical} animal(s) requiring immediate attention
            </p>
            <p className="text-sm text-red-700">
              Critical health status detected. Check individual animals for detailed information.
            </p>
          </div>
        </div>
      )}

      {metrics.warning > 0 && metrics.critical === 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 flex gap-4">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-900 mb-1">
              {metrics.warning} animal(s) with warning status
            </p>
            <p className="text-sm text-yellow-700">
              Monitor these animals closely over the next 24 hours.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
