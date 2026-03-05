import { useState } from 'react'
import type { Activity } from './types'

interface ActivityListProps {
  activities: Activity[]
  pendingId: string | null
  onEdit: (activity: Activity) => void
  onDelete: (activity: Activity) => void
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today) return `Today ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

/** Sort/time for ordering and day grouping: end_time if set, else created_at. */
function getSortTime(a: Activity): string {
  return a.end_time ?? a.created_at
}

/** Local date key (YYYY-MM-DD) from an ISO string for grouping. */
function getDayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Format total minutes as "Xh Ym". */
function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Get local YYYY-MM-DD and HH:mm from an ISO string for date/time inputs. */
function parseEndTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return {
    date: `${y}-${m}-${day}`,
    time: `${h}:${min}`,
  }
}

interface EditFormProps {
  activity: Activity
  pending: boolean
  onSave: (updated: Activity) => void
  onCancel: () => void
}

function EditForm({ activity, pending, onSave, onCancel }: EditFormProps) {
  const [name, setName] = useState(activity.name)
  const [duration, setDuration] = useState(String(activity.duration_minutes))
  const [showEndTime, setShowEndTime] = useState(!!activity.end_time)
  const parsed = parseEndTime(activity.end_time)
  const [endDate, setEndDate] = useState(parsed.date)
  const [endTime, setEndTime] = useState(parsed.time)

  function getEndTimeISO(): string | null {
    if (!endDate || !endTime) return null
    const d = new Date(`${endDate}T${endTime}:00`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const mins = parseInt(duration, 10)
    if (!name.trim() || Number.isNaN(mins) || mins < 1) return
    onSave({
      ...activity,
      name: name.trim(),
      duration_minutes: mins,
      end_time: showEndTime ? getEndTimeISO() : null,
    })
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form className="list-item-edit" onSubmit={handleSubmit} aria-busy={pending}>
      <fieldset className="list-item-edit-fieldset" disabled={pending}>
        <div className="list-item-edit-row">
          <input
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
        </div>
        <div className="list-item-edit-optional">
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
        <div className="list-item-edit-actions">
          {pending && (
            <span className="list-item-spinner" aria-hidden>
              <span className="spinner" />
            </span>
          )}
          <button type="button" className="list-item-edit-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="form-submit" disabled={pending}>
            Save
          </button>
        </div>
      </fieldset>
    </form>
  )
}

export function ActivityList({ activities, pendingId, onEdit, onDelete }: ActivityListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = editingId ? activities.find((a) => a.id === editingId) : null

  if (activities.length === 0) {
    return (
      <p className="list-empty">
        No activities yet. Add one above.
      </p>
    )
  }

  // Sort by end_time if set, else created_at (newest first); group by that same date
  const sorted = [...activities].sort((a, b) => {
    const tA = getSortTime(a)
    const tB = getSortTime(b)
    return tB.localeCompare(tA)
  })
  const dayGroups = (() => {
    const map = new Map<string, Activity[]>()
    for (const a of sorted) {
      const key = getDayKey(getSortTime(a))
      if (!key) continue
      const group = map.get(key) ?? []
      group.push(a)
      map.set(key, group)
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  })()

  return (
    <ul className="list">
      {dayGroups.map(([dayKey, dayActivities]) => {
        const totalMinutes = dayActivities.reduce((sum, a) => sum + a.duration_minutes, 0)
        const summaryLabel = formatDuration(totalMinutes)
        const now = new Date()
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
        let dayLabel = dayKey
        if (dayKey === todayKey) dayLabel = 'Today'
        else if (dayKey === yesterdayKey) dayLabel = 'Yesterday'
        else {
          const d = new Date(dayKey)
          dayLabel = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
        }
        return (
          <li key={dayKey} className="list-day-group">
            <div className="list-day-summary" aria-label={`${dayLabel}: ${summaryLabel} logged`}>
              <span className="list-day-summary-date">{dayLabel}</span>
              <span className="list-day-summary-total">{summaryLabel}</span>
            </div>
            <ul className="list list--nested">
              {dayActivities.map((a) => {
                const isPending = pendingId === a.id
                return (
                  <li key={a.id} className="list-item" aria-busy={isPending}>
                    {editing?.id === a.id ? (
                      <EditForm
                        activity={a}
                        pending={isPending}
                        onSave={(updated) => {
                          onEdit(updated)
                          setEditingId(null)
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <div className="list-item-main">
                          <span className="list-item-name">{a.name}</span>
                          <span className="list-item-meta">
                            {a.duration_minutes} min
                            {a.end_time && (
                              <span className="list-item-end"> · ended {formatDate(a.end_time)}</span>
                            )}
                          </span>
                        </div>
                        <span className="list-item-date">{formatDate(a.created_at)}</span>
                        <div className="list-item-actions">
                          {isPending && (
                            <span className="list-item-spinner" aria-hidden>
                              <span className="spinner" />
                            </span>
                          )}
                          <button
                            type="button"
                            className="list-item-edit-btn"
                            onClick={() => setEditingId(a.id)}
                            title="Edit"
                            aria-label="Edit"
                            disabled={isPending}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="list-item-delete"
                            onClick={() => onDelete(a)}
                            title="Delete"
                            aria-label="Delete"
                            disabled={isPending}
                          >
                            ×
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
