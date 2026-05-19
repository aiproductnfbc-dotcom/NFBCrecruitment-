import { useEffect, useState, useCallback } from 'react'
import {
  StickyNote, Phone, Mail, Calendar, CheckSquare, ArrowRightLeft,
  Layers, Plus, Pencil, Pin, ChevronDown, Loader2, X, Check,
} from 'lucide-react'
import { Skeleton } from './LoadingSkeleton'
import {
  getActivities, createActivity, updateActivity, deleteActivity,
  type Activity, type ActivitySubjectType, type ActivityType,
} from '../lib/activityService'
import { useAuth } from '../context/AuthContext'

// ─── Icon + colour by activity type ─────────────────────────────────────────

const TYPE_META: Record<ActivityType, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; label: string }> = {
  note:          { icon: StickyNote,      color: 'text-yellow-500 bg-yellow-50',   label: 'Note' },
  call:          { icon: Phone,           color: 'text-blue-500 bg-blue-50',       label: 'Call' },
  email_logged:  { icon: Mail,            color: 'text-indigo-500 bg-indigo-50',   label: 'Email' },
  meeting:       { icon: Calendar,        color: 'text-green-500 bg-green-50',     label: 'Meeting' },
  task:          { icon: CheckSquare,     color: 'text-purple-500 bg-purple-50',   label: 'Task' },
  status_change: { icon: ArrowRightLeft,  color: 'text-orange-500 bg-orange-50',   label: 'Status change' },
  stage_change:  { icon: Layers,          color: 'text-teal-500 bg-teal-50',       label: 'Stage change' },
  created:       { icon: Plus,            color: 'text-emerald-500 bg-emerald-50', label: 'Created' },
  updated:       { icon: Pencil,          color: 'text-gray-400 bg-gray-50',       label: 'Updated' },
}

const LOGGABLE: ActivityType[] = ['note', 'call', 'email_logged', 'meeting', 'task']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  const hr   = Math.floor(diff / 3_600_000)
  const day  = Math.floor(diff / 86_400_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  if (hr  < 24) return `${hr}h ago`
  if (day < 7)  return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Add-activity form ───────────────────────────────────────────────────────

interface AddActivityFormProps {
  subjectType: ActivitySubjectType
  subjectId:   string
  onCreated:   (a: Activity) => void
}

function AddActivityForm({ subjectType, subjectId, onCreated }: AddActivityFormProps) {
  const [open,    setOpen]    = useState(false)
  const [type,    setType]    = useState<ActivityType>('note')
  const [title,   setTitle]   = useState('')
  const [body,    setBody]    = useState('')
  const [dueAt,   setDueAt]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const reset = () => { setTitle(''); setBody(''); setDueAt(''); setError(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    try {
      const activity = await createActivity({
        subject_type: subjectType,
        subject_id:   subjectId,
        activity_type: type,
        title:        title.trim(),
        body:         body.trim() || undefined,
        due_at:       (type === 'task' && dueAt) ? dueAt : undefined,
      })
      onCreated(activity)
      reset()
      setOpen(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <Plus size={15} />
        Log activity
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Log activity</span>
        <button type="button" onClick={() => { reset(); setOpen(false) }} className="text-gray-400 hover:text-gray-600">
          <X size={15} />
        </button>
      </div>

      {/* Type selector */}
      <div className="flex flex-wrap gap-1.5">
        {LOGGABLE.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              type === t
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Notes (optional)"
        rows={3}
        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {type === 'task' && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Due date (optional)</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={e => setDueAt(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => { reset(); setOpen(false) }}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          Save
        </button>
      </div>
    </form>
  )
}

// ─── Activity card ───────────────────────────────────────────────────────────

interface ActivityCardProps {
  activity:  Activity
  onUpdated: (a: Activity) => void
  onDeleted: (id: string) => void
}

function ActivityCard({ activity, onUpdated, onDeleted }: ActivityCardProps) {
  const { user } = useAuth()
  const meta = TYPE_META[activity.activity_type] ?? TYPE_META.note
  const Icon = meta.icon
  const [editing, setEditing]   = useState(false)
  const [title,   setTitle]     = useState(activity.title)
  const [body,    setBody]      = useState(activity.body ?? '')
  const [saving,  setSaving]    = useState(false)
  const [pinning, setPinning]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canEdit = user?.id === activity.created_by || !activity.created_by

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const updated = await updateActivity(activity.id, { title: title.trim(), body: body.trim() || null })
      onUpdated(updated)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handlePin = async () => {
    setPinning(true)
    try {
      const updated = await updateActivity(activity.id, { is_pinned: !activity.is_pinned })
      onUpdated(updated)
    } finally {
      setPinning(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this activity?')) return
    setDeleting(true)
    try {
      await deleteActivity(activity.id)
      onDeleted(activity.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={`flex gap-3 group ${activity.is_pinned ? 'bg-yellow-50/40' : ''}`}>
      {/* Icon bubble */}
      <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${meta.color}`}>
        <Icon size={14} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 disabled:opacity-50">
                {saving && <Loader2 size={11} className="animate-spin" />}
                <Check size={11} /> Save
              </button>
              <button onClick={() => { setTitle(activity.title); setBody(activity.body ?? ''); setEditing(false) }} className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-800 leading-snug">
                {activity.is_pinned && <Pin size={11} className="inline text-yellow-500 mr-1 -mt-0.5" />}
                {activity.title}
              </p>
              {/* Actions — visible on hover */}
              {canEdit && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={handlePin}
                    disabled={pinning}
                    title={activity.is_pinned ? 'Unpin' : 'Pin'}
                    className="p-1 text-gray-400 hover:text-yellow-500 rounded"
                  >
                    <Pin size={13} />
                  </button>
                  <button onClick={() => setEditing(true)} title="Edit" className="p-1 text-gray-400 hover:text-blue-500 rounded">
                    <Pencil size={13} />
                  </button>
                  <button onClick={handleDelete} disabled={deleting} title="Delete" className="p-1 text-gray-400 hover:text-red-500 rounded">
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            {activity.body && (
              <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{activity.body}</p>
            )}

            {activity.due_at && (
              <p className="text-xs text-gray-400 mt-1">Due: {formatDate(activity.due_at)}</p>
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">{formatRelative(activity.occurred_at)}</span>
          {activity.creator?.full_name && (
            <span className="text-xs text-gray-400">· {activity.creator.full_name}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ActivityTimeline ─────────────────────────────────────────────────────────

interface ActivityTimelineProps {
  subjectType: ActivitySubjectType
  subjectId:   string
}

export default function ActivityTimeline({ subjectType, subjectId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading,    setLoading]    = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,    setHasMore]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const LIMIT = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getActivities(subjectType, subjectId, { limit: LIMIT + 1 })
      setHasMore(data.length > LIMIT)
      setActivities(data.slice(0, LIMIT))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [subjectType, subjectId])

  useEffect(() => { load() }, [load])

  const loadMore = async () => {
    if (!activities.length) return
    const cursor = activities[activities.length - 1].occurred_at
    setLoadingMore(true)
    try {
      const data = await getActivities(subjectType, subjectId, { limit: LIMIT + 1, before: cursor })
      setHasMore(data.length > LIMIT)
      setActivities(prev => [...prev, ...data.slice(0, LIMIT)])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleCreated = (a: Activity) => {
    // Insert at top (after pinned)
    setActivities(prev => {
      const pinned   = prev.filter(x => x.is_pinned)
      const unpinned = prev.filter(x => !x.is_pinned)
      return a.is_pinned ? [a, ...pinned, ...unpinned] : [...pinned, a, ...unpinned]
    })
  }

  const handleUpdated = (updated: Activity) => {
    setActivities(prev => {
      const list = prev.map(a => a.id === updated.id ? updated : a)
      // Re-sort so pinned are first
      return [...list.filter(a => a.is_pinned), ...list.filter(a => !a.is_pinned)]
    })
  }

  const handleDeleted = (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-4">
      <AddActivityForm
        subjectType={subjectType}
        subjectId={subjectId}
        onCreated={handleCreated}
      />

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : !activities.length ? (
        <p className="text-sm text-gray-400 py-6 text-center">No activity yet.</p>
      ) : (
        <div className="space-y-4">
          {activities.map(a => (
            <ActivityCard
              key={a.id}
              activity={a}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  )
}
