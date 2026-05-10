import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Vendor } from '../types'
import '../styles/CoupleTaskList.css'

interface Task {
  id: string
  title: string
  due_date: string | null
  is_done: boolean
  priority: 'low' | 'normal' | 'high'
  vendor_id: string | null
}

interface Props {
  weddingId: string
  vendors: Vendor[]
}

const PRIORITY_LABEL: Record<string, string> = { low: 'נמוכה', normal: 'רגילה', high: 'גבוהה' }
const PRIORITY_COLOR: Record<string, string> = { low: '#90be6d', normal: '#6c63ff', high: '#e63946' }

export const CoupleTaskList: React.FC<Props> = ({ weddingId, vendors }) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterVendor, setFilterVendor] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', due_date: '', priority: 'normal' as Task['priority'], vendor_id: '' })

  useEffect(() => { fetchTasks() }, [weddingId])

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('due_date', { ascending: true, nullsFirst: false })
    setTasks(data || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const { data } = await supabase.from('tasks').insert([{
      wedding_id: weddingId,
      title: form.title.trim(),
      due_date: form.due_date || null,
      priority: form.priority,
      vendor_id: form.vendor_id || null,
      is_done: false,
    }]).select().single()
    if (data) setTasks(p => [...p, data])
    setForm({ title: '', due_date: '', priority: 'normal', vendor_id: '' })
    setShowForm(false)
    setSaving(false)
  }

  const toggleDone = async (task: Task) => {
    const updated = { ...task, is_done: !task.is_done }
    setTasks(p => p.map(t => t.id === task.id ? updated : t))
    await supabase.from('tasks').update({ is_done: updated.is_done }).eq('id', task.id)
  }

  const handleDelete = async (id: string) => {
    setTasks(p => p.filter(t => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  const filtered = filterVendor === 'all'
    ? tasks
    : filterVendor === 'none'
      ? tasks.filter(t => !t.vendor_id)
      : tasks.filter(t => t.vendor_id === filterVendor)

  const vendorName = (id: string | null) => {
    if (!id) return null
    const v = vendors.find(v => v.id === id)
    return v ? (v.vendor_name || v.category) : null
  }

  const formatDate = (d: string | null) => {
    if (!d) return null
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  if (loading) return <div className="ctl-loading">טוען משימות...</div>

  return (
    <div className="ctl-wrap" dir="rtl">
      <div className="ctl-header">
        <div className="ctl-filter-row">
          <select className="ctl-select" value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
            <option value="all">כל המשימות</option>
            <option value="none">ללא ספק</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.vendor_name || v.category}</option>
            ))}
          </select>
          <span className="ctl-count">{filtered.filter(t => !t.is_done).length} פתוחות</span>
        </div>
        <button className="ctl-add-btn" onClick={() => setShowForm(s => !s)}>
          {showForm ? '✕ ביטול' : '+ משימה חדשה'}
        </button>
      </div>

      {showForm && (
        <div className="ctl-form">
          <input
            className="ctl-input ctl-input-title"
            placeholder="כותרת המשימה *"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          />
          <div className="ctl-form-row">
            <input
              className="ctl-input"
              type="date"
              value={form.due_date}
              onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
            />
            <select className="ctl-select" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as Task['priority'] }))}>
              <option value="high">עדיפות גבוהה</option>
              <option value="normal">עדיפות רגילה</option>
              <option value="low">עדיפות נמוכה</option>
            </select>
            <select className="ctl-select" value={form.vendor_id} onChange={e => setForm(p => ({ ...p, vendor_id: e.target.value }))}>
              <option value="">— ללא ספק —</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.vendor_name || v.category}</option>
              ))}
            </select>
          </div>
          <button className="ctl-save-btn" onClick={handleAdd} disabled={saving || !form.title.trim()}>
            {saving ? 'שומר...' : 'הוסף משימה'}
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="ctl-empty">אין משימות עדיין — לחצו על "+ משימה חדשה" כדי להתחיל</div>
      )}

      <div className="ctl-list">
        {filtered.map(task => (
          <div key={task.id} className={`ctl-task ${task.is_done ? 'ctl-done' : ''}`}>
            <button className="ctl-checkbox" onClick={() => toggleDone(task)}>
              {task.is_done ? '✓' : ''}
            </button>
            <div className="ctl-task-body">
              <span className="ctl-task-title">{task.title}</span>
              <div className="ctl-task-meta">
                {task.due_date && (
                  <span className="ctl-meta-date">📅 {formatDate(task.due_date)}</span>
                )}
                <span className="ctl-meta-priority" style={{ color: PRIORITY_COLOR[task.priority] }}>
                  ● {PRIORITY_LABEL[task.priority]}
                </span>
                {vendorName(task.vendor_id) && (
                  <span className="ctl-meta-vendor">🔗 {vendorName(task.vendor_id)}</span>
                )}
              </div>
            </div>
            <button className="ctl-delete-btn" onClick={() => handleDelete(task.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
