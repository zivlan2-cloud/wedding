import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Couple } from '../types'
import '../styles/ShirTasks.css'

interface ShirTasksProps {
  couples: Couple[]
}

interface Task {
  id: string
  created_at: string
  wedding_id: string | null
  title: string
  due_date: string | null
  is_done: boolean
  priority: 'low' | 'normal' | 'high'
}

type ViewMode = 'byCouple' | 'byDate'

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  high: 'דחוף',
  normal: 'רגיל',
  low: 'נמוך',
}

const PRIORITY_ICONS: Record<Task['priority'], string> = {
  high: '🔴',
  normal: '🟡',
  low: '🟢',
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDate(d: string | null): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function taskStatus(task: Task): 'overdue' | 'today' | 'normal' {
  if (task.is_done) return 'normal'
  if (!task.due_date) return 'normal'
  const today = todayStr()
  if (task.due_date < today) return 'overdue'
  if (task.due_date === today) return 'today'
  return 'normal'
}

export const ShirTasks: React.FC<ShirTasksProps> = ({ couples }) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('byDate')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    due_date: '',
    wedding_id: '',
    priority: 'normal' as Task['priority'],
  })

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
    setTasks(data || [])
    setLoading(false)
  }

  const toggleDone = async (task: Task) => {
    const newVal = !task.is_done
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: newVal } : t))
    await supabase.from('tasks').update({ is_done: newVal }).eq('id', task.id)
  }

  const deleteTask = async (id: string) => {
    if (!confirm('למחוק משימה זו?')) return
    setTasks(prev => prev.filter(t => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      due_date: form.due_date || null,
      wedding_id: form.wedding_id || null,
      priority: form.priority,
      is_done: false,
    }
    const { data } = await supabase.from('tasks').insert([payload]).select()
    if (data && data.length > 0) {
      setTasks(prev => {
        const updated = [...prev, data[0]]
        return updated.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return a.due_date.localeCompare(b.due_date)
        })
      })
    }
    setForm({ title: '', due_date: '', wedding_id: '', priority: 'normal' })
    setShowForm(false)
    setSaving(false)
  }

  const getCoupleName = (weddingId: string | null): string => {
    if (!weddingId) return 'כללי'
    const c = couples.find(c => c.id === weddingId)
    if (!c) return 'לא ידוע'
    return c.couple_name || `${c.partner1_name} ו${c.partner2_name}`
  }

  // Pending (not done) vs done split
  const pending = tasks.filter(t => !t.is_done)
  const done = tasks.filter(t => t.is_done)

  // ByDate: flat sorted list (pending first, then done)
  const byDateList = [...pending, ...done]

  // ByCouple: group pending by couple
  const coupleGroups: Record<string, Task[]> = {}
  pending.forEach(t => {
    const key = t.wedding_id || '__general__'
    if (!coupleGroups[key]) coupleGroups[key] = []
    coupleGroups[key].push(t)
  })
  // Sort groups: general first, then by couple name
  const groupKeys = Object.keys(coupleGroups).sort((a, b) => {
    if (a === '__general__') return -1
    if (b === '__general__') return 1
    return getCoupleName(a).localeCompare(getCoupleName(b), 'he')
  })

  const pendingCount = pending.length
  const overdueCount = pending.filter(t => taskStatus(t) === 'overdue').length

  return (
    <div className="st-page" dir="rtl">
      <div className="st-header">
        <div className="st-title-row">
          <h2 className="st-title">משימות</h2>
          <div className="st-header-badges">
            {pendingCount > 0 && (
              <span className="st-badge st-badge-pending">{pendingCount} פתוחות</span>
            )}
            {overdueCount > 0 && (
              <span className="st-badge st-badge-overdue">{overdueCount} באיחור</span>
            )}
          </div>
        </div>
        <div className="st-controls">
          <div className="st-view-toggle">
            <button
              className={`st-view-btn ${viewMode === 'byDate' ? 'active' : ''}`}
              onClick={() => setViewMode('byDate')}
            >
              לפי תאריך
            </button>
            <button
              className={`st-view-btn ${viewMode === 'byCouple' ? 'active' : ''}`}
              onClick={() => setViewMode('byCouple')}
            >
              לפי זוג
            </button>
          </div>
          <button
            className="st-add-btn"
            onClick={() => setShowForm(s => !s)}
          >
            {showForm ? '✕ ביטול' : '+ משימה חדשה'}
          </button>
        </div>
      </div>

      {/* Add task form */}
      {showForm && (
        <form className="st-form" onSubmit={addTask} dir="rtl">
          <div className="st-form-row">
            <input
              className="st-input st-input-title"
              type="text"
              placeholder="כותרת המשימה *"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              required
            />
            <input
              className="st-input st-input-date"
              type="date"
              value={form.due_date}
              onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
            />
          </div>
          <div className="st-form-row">
            <select
              className="st-input st-input-couple"
              value={form.wedding_id}
              onChange={e => setForm(p => ({ ...p, wedding_id: e.target.value }))}
            >
              <option value="">כללי (ללא זוג)</option>
              {couples.map(c => (
                <option key={c.id} value={c.id}>
                  {c.couple_name || `${c.partner1_name} ו${c.partner2_name}`}
                </option>
              ))}
            </select>
            <select
              className="st-input st-input-priority"
              value={form.priority}
              onChange={e => setForm(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
            >
              <option value="high">🔴 דחוף</option>
              <option value="normal">🟡 רגיל</option>
              <option value="low">🟢 נמוך</option>
            </select>
            <button className="st-submit-btn" type="submit" disabled={saving}>
              {saving ? 'שומר...' : 'הוסף'}
            </button>
          </div>
        </form>
      )}

      {loading && <div className="st-loading">טוען משימות...</div>}

      {!loading && tasks.length === 0 && (
        <div className="st-empty">
          <p>אין משימות עדיין — לחצי על "משימה חדשה" להתחיל</p>
        </div>
      )}

      {/* BY DATE VIEW */}
      {!loading && viewMode === 'byDate' && byDateList.length > 0 && (
        <div className="st-list">
          {byDateList.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              coupleName={getCoupleName(task.wedding_id)}
              showCouple={true}
              onToggle={toggleDone}
              onDelete={deleteTask}
            />
          ))}
        </div>
      )}

      {/* BY COUPLE VIEW */}
      {!loading && viewMode === 'byCouple' && (
        <div className="st-groups">
          {groupKeys.map(key => (
            <div key={key} className="st-group">
              <div className="st-group-header">
                <span className="st-group-name">
                  {key === '__general__' ? '📋 כללי' : `👫 ${getCoupleName(key)}`}
                </span>
                <span className="st-group-count">{coupleGroups[key].length}</span>
              </div>
              <div className="st-group-tasks">
                {coupleGroups[key].map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    coupleName={getCoupleName(task.wedding_id)}
                    showCouple={false}
                    onToggle={toggleDone}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            </div>
          ))}
          {done.length > 0 && (
            <div className="st-group st-group-done">
              <div className="st-group-header">
                <span className="st-group-name">✅ הושלמו</span>
                <span className="st-group-count">{done.length}</span>
              </div>
              <div className="st-group-tasks">
                {done.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    coupleName={getCoupleName(task.wedding_id)}
                    showCouple={true}
                    onToggle={toggleDone}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            </div>
          )}
          {groupKeys.length === 0 && done.length === 0 && (
            <div className="st-empty">
              <p>אין משימות פתוחות</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---- TaskRow sub-component ---- */

interface TaskRowProps {
  task: Task
  coupleName: string
  showCouple: boolean
  onToggle: (task: Task) => void
  onDelete: (id: string) => void
}

const TaskRow: React.FC<TaskRowProps> = ({ task, coupleName, showCouple, onToggle, onDelete }) => {
  const status = taskStatus(task)

  return (
    <div className={`st-task ${task.is_done ? 'st-task-done' : ''} st-task-${status}`}>
      <label className="st-check-wrap">
        <input
          type="checkbox"
          checked={task.is_done}
          onChange={() => onToggle(task)}
          className="st-checkbox"
        />
        <span className="st-checkmark" />
      </label>

      <div className="st-task-body">
        <span className="st-task-title">{task.title}</span>
        <div className="st-task-meta">
          {task.due_date && (
            <span className={`st-task-date ${status === 'overdue' ? 'st-date-overdue' : status === 'today' ? 'st-date-today' : ''}`}>
              📅 {formatDate(task.due_date)}
              {status === 'overdue' && ' — באיחור!'}
              {status === 'today' && ' — היום!'}
            </span>
          )}
          {showCouple && (
            <span className="st-task-couple-tag">{coupleName}</span>
          )}
          <span className={`st-priority-badge st-priority-${task.priority}`}>
            {PRIORITY_ICONS[task.priority]} {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
      </div>

      <button
        className="st-delete-btn"
        onClick={() => onDelete(task.id)}
        title="מחק משימה"
      >
        ✕
      </button>
    </div>
  )
}
