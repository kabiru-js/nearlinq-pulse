'use client'

import { useState } from 'react'
import { createCheckup, type Checkup } from '@/lib/api'

interface CheckupFormProps {
  animalId: string
  onRecorded: (checkup: Checkup) => void
  onCancel: () => void
}

export function CheckupForm({ animalId, onRecorded, onCancel }: CheckupFormProps) {
  const [weightKg, setWeightKg] = useState('')
  const [performedBy, setPerformedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [verdict, setVerdict] = useState<'healthy' | 'warning' | 'critical' | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const checkup = await createCheckup(animalId, {
        weightKg: weightKg === '' ? undefined : Number(weightKg),
        performedBy: performedBy === '' ? undefined : performedBy,
        notes: notes === '' ? undefined : notes,
        verdict: verdict === '' ? undefined : verdict,
      })
      setSuccess(true)
      setWeightKg('')
      setNotes('')
      setPerformedBy('')
      setVerdict('')
      onRecorded(checkup)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record check-up')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <h3 className="font-semibold text-gray-800">Record Check-up</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-gray-600 mb-1 block">Weight (kg)</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="e.g. 620"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600 mb-1 block">Performed by</span>
          <input
            type="text"
            value={performedBy}
            onChange={(e) => setPerformedBy(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="e.g. Dr. Smith"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-gray-600 mb-1 block">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Observations, treatment, diet changes..."
        />
      </label>

      <div className="text-sm">
        <span className="text-gray-600 mb-1 block">
          Vet verdict <span className="text-gray-400">(optional — labels the ML training data)</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: 'healthy', label: 'Healthy', active: 'bg-green-500 text-white', idle: 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400' },
              { value: 'warning', label: 'Warning', active: 'bg-yellow-500 text-white', idle: 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400' },
              { value: 'critical', label: 'Critical', active: 'bg-red-500 text-white', idle: 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setVerdict(verdict === option.value ? '' : option.value)}
              className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition ${
                verdict === option.value ? option.active : option.idle
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && (
        <p className="text-green-700 text-sm">
          Check-up recorded — it appears in the history view.
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          {submitting ? 'Saving…' : 'Save Check-up'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
