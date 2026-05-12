import React, { useEffect, useRef, useState } from 'react'
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
  sort_order: number
}

interface Props {
  weddingId: string
  vendors: Vendor[]
}

const PRIORITY_LABEL: Record<string, string> = { low: 'נמוכה', normal: 'רגילה', high: 'גבוהה' }
const PRIORITY_COLOR: Record<string, string> = { low: '#90be6d', normal: '#6c63ff', high: '#e63946' }

const sortByDate = (list: Task[]) => [...list].sort((a, b) => {
  if (!a.due_date && !b.due_date) return 0
  if (!a.due_date) return 1
  if (!b.due_date) return -1
  return a.due_date.localeCompare(b.due_date)
})

export const CoupleTaskList: React.FC<Props> = ({ weddingId, vendors }) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterVendor, setFilterVendor] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', due_date: '', priority: 'normal' as Task['priority'], vendor_id: '' })
  const [dragOver, setDragOver] = useState<number | null>(null)

  // Refs for drag (mouse) and touch
  const dragIdx = useRef<number | null>(null)
  const touchDragIdx = useRef<number | null>(null)
  const touchDragOver = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchTasks() }, [weddingId])

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('sort_order', { ascending: true })
    const list = data || []
    const allZero = list.every(t => (t.sort_order || 0) === 0)
    setTasks(allZero ? sortByDate(list) : list)
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.sort_order || 0)) + 1 : 0
    const { data } = await supabase.from('tasks').insert([{
      wedding_id: weddingId,
      title: form.title.trim(),
      due_date: form.due_date || null,
      priority: form.priority,
      vendor_id: form.vendor_id || null,
      is_done: false,
      sort_order: maxOrder,
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

  const handleSortByDate = () => setTasks(p => sortByDate(p))

  const applyReorder = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return
    const reordered = [...tasks]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const withOrder = reordered.map((t, i) => ({ ...t, sort_order: i }))
    setTasks(withOrder)
    await Promise.all(withOrder.map(t =>
      supabase.from('tasks').update({ sort_order: t.sort_order }).eq('id', t.id)
    ))
  }

  // ── Mouse drag handlers ──
  const handleDragStart = (idx: number) => { dragIdx.current = idx }

  const handleDrop = async (toIdx: number) => {
    if (dragIdx.current === null) return
    await applyReorder(dragIdx.current, toIdx)
    dragIdx.current = null
    setDragOver(null)
  }

  // ── Touch drag handlers ──
  const handleTouchStart = (idx: number) => {
    touchDragIdx.current = idx
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchDragIdx.current === null || !listRef.current) return
    const touch = e.touches[0]
    const elements = listRef.current.querySelectorAll('.ctl-task')
    let overIdx: number | null = null
    elements.forEach((el, i) => {
      const rect = el.getBoundingClientRect()
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) overIdx = i
    })
    if (overIdx !== null) {
      touchDragOver.current = overIdx
      setDragOver(overIdx)
    }
  }

  const handleTouchEnd = async () => {
    if (touchDragIdx.current !== null && touchDragOver.current !== null) {
      await applyReorder(touchDragIdx.current, touchDragOver.current)
    }
    touchDragIdx.current = null
    touchDragOver.current = null
    setDragOver(null)
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
          <button className="ctl-sort-date-btn" onClick={handleSortByDate}>📅 מיין לפי תאריך</button>
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

      <div className="ctl-list" ref={listRef}>
        {filtered.map((task, idx) => (
          <div
            key={task.id}
            className={`ctl-task ${task.is_done ? 'ctl-done' : ''} ${dragOver === idx ? 'ctl-drag-over' : ''}`}
            draggable={filterVendor === 'all'}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(idx)}
            onTouchStart={() => handleTouchStart(idx)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {filterVendor === 'all' && <span className="ctl-drag-handle">⠿</span>}
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
