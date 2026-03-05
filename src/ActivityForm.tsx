import { useState, useRef } from 'react'
import type { ActivityInsert } from './types'

interface ActivityFormProps {
  onSubmit: (entry: ActivityInsert) => void
}

export function ActivityForm({ onSubmit }: ActivityFormProps) {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('')
  const [showEndTime, setShowEndTime] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  function getEndTimeISO(): string | null {
    if (!endDate || !endTime) return null
    // Treat date+time as local; send UTC instant so Sheets stores the correct moment
    const d = new Date(`${endDate}T${endTime}:00`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const mins = parseInt(duration, 10)
    if (!name.trim() || Number.isNaN(mins) || mins < 1) return
    onSubmit({
      name: name.trim(),
      duration_minutes: mins,
      end_time: showEndTime ? getEndTimeISO() : null,
    })
    setName('')
    setDuration('')
    setShowEndTime(false)
    setEndDate('')
    setEndTime('')
    nameInputRef.current?.focus()
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-row">
        <input
          ref={nameInputRef}
          type="text"
          placeholder="Activity name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input form-input--name"
          autoFocus
        />
        <input
          type="number"
          placeholder="Min"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          min={1}
          max={9999}
          className="form-input form-input--duration"
        />
        <button type="submit" className="form-submit">
          Log
        </button>
      </div>
      <div className="form-optional">
        <button
          type="button"
          className="form-optional-toggle"
          onClick={() => setShowEndTime((v) => !v)}
          aria-pressed={showEndTime}
        >
          {showEndTime ? '− Hide end time' : '+ Set end time (backfill)'}
        </button>
        {showEndTime && (
          <div className="form-optional-fields">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
              max={today}
            />
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="form-input"
            />
          </div>
        )}
      </div>
    </form>
  )
}
