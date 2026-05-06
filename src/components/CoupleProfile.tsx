import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Couple, Vendor } from '../types'
import { VendorWorksheet } from './VendorWorksheet'
import { ContractGenerator } from './ContractGenerator'
import '../styles/CoupleProfile.css'

interface Task {
  id: string
  title: string
  due_date: string | null
  is_done: boolean
  priority: 'low' | 'normal' | 'high'
}

function formatTaskDate(d: string | null) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function isOverdue(t: Task) {
  if (t.is_done || !t.due_date) return false
  return t.due_date < new Date().toISOString().split('T')[0]
}

interface CoupleProfileProps {
  couple: Couple
  onStatusChange: (status: string) => void
  onUpdate: (couple: Couple) => void
  onDelete: () => void
}

const STATUS_OPTIONS = ['מתלבטים', 'פעילים', 'עבר']
const STATUS_COLORS: Record<string, string> = {
  'מתלבטים': '#f8961e',
  'פעילים': '#6c63ff',
  'עבר': '#90be6d',
}

export const CoupleProfile: React.FC<CoupleProfileProps> = ({ couple, onStatusChange, onUpdate, onDelete }) => {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [documents, setDocuments] = useState<{ id: string; file_name: string; file_url: string; doc_zone?: string }[]>([])
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [notes, setNotes] = useState(couple.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showContract, setShowContract] = useState(false)
  const [sketch, setSketch] = useState<{ url: string; name: string } | null>(null)
  const [uploadingSketch, setUploadingSketch] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskInput, setTaskInput] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [taskPriority, setTaskPriority] = useState<Task['priority']>('normal')
  const [addingTask, setAddingTask] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [dateValue, setDateValue] = useState(
    couple.event_date && couple.event_date !== '2099-01-01' ? couple.event_date : ''
  )
  const [savingDate, setSavingDate] = useState(false)

  useEffect(() => {
    fetchVendors()
    fetchDocuments()
    fetchTasks()
    setNotes(couple.notes || '')
  }, [couple.id])

  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks').select('*')
      .eq('wedding_id', couple.id).order('due_date', { ascending: true, nullsFirst: false })
    setTasks(data || [])
  }

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskInput.trim()) return
    setAddingTask(true)
    const { data } = await supabase.from('tasks').insert([{
      title: taskInput.trim(),
      due_date: taskDue || null,
      wedding_id: couple.id,
      priority: taskPriority,
      is_done: false,
    }]).select()
    if (data) setTasks(prev => [...prev, data[0]])
    setTaskInput('')
    setTaskDue('')
    setTaskPriority('normal')
    setAddingTask(false)
  }

  const toggleTask = async (task: Task) => {
    const newVal = !task.is_done
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: newVal } : t))
    await supabase.from('tasks').update({ is_done: newVal }).eq('id', task.id)
  }

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    await supabase.from('tasks').delete().eq('id', id)
  }

  const fetchVendors = async () => {
    const { data } = await supabase.from('vendors').select('*').eq('wedding_id', couple.id).order('sort_order').order('created_at')
    setVendors(data || [])
  }

  const fetchDocuments = async () => {
    const { data } = await supabase.from('documents').select('*').eq('wedding_id', couple.id).order('created_at', { ascending: false })
    setDocuments(data || [])
    const sketchDoc = (data || []).find(d => d.doc_zone === 'sketch')
    if (sketchDoc) setSketch({ url: sketchDoc.file_url, name: sketchDoc.file_name })
    else setSketch(null)
  }

  const handleSketchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingSketch(true)
    try {
      if (sketch) {
        const oldParts = sketch.url.split('/object/public/documents/')
        if (oldParts[1]) await supabase.storage.from('documents').remove([decodeURIComponent(oldParts[1])])
        await supabase.from('documents').delete().eq('wedding_id', couple.id).eq('doc_zone', 'sketch')
      }
      const safeName = file.name.replace(/[^\w.\-]/g, '_')
      const path = `${couple.id}/sketch_${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
      await supabase.from('documents').insert([{
        wedding_id: couple.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        uploaded_by: 'shir',
        doc_zone: 'sketch',
      }])
      setSketch({ url: urlData.publicUrl, name: file.name })
    } catch (err) {
      alert('שגיאה בהעלאה: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploadingSketch(false)
      e.target.value = ''
    }
  }

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, zone: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(zone)
    try {
      const safeName = file.name.replace(/[^\w.\-]/g, '_')
      const path = `${couple.id}/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
      await supabase.from('documents').insert([{
        wedding_id: couple.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        uploaded_by: 'shir',
        doc_zone: zone,
      }])
      fetchDocuments()
    } catch (err) {
      alert('שגיאה בהעלאה: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploadingDoc(null)
      e.target.value = ''
    }
  }

  const handleDeleteDoc = async (id: string, fileUrl: string) => {
    if (!confirm('למחוק מסמך זה?')) return
    try {
      const parts = fileUrl.split('/object/public/documents/')
      if (parts[1]) await supabase.storage.from('documents').remove([decodeURIComponent(parts[1])])
    } catch {}
    await supabase.from('documents').delete().eq('id', id)
    fetchDocuments()
  }

  const handleDeleteCouple = async () => {
    if (!confirm(`למחוק את ${couple.couple_name || couple.partner1_name + ' ו' + couple.partner2_name}?\nפעולה זו תמחק גם את כל הספקים והמסמכים שלהם.`)) return
    await supabase.from('couples').delete().eq('id', couple.id)
    onDelete()
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    await supabase.from('couples').update({ notes }).eq('id', couple.id)
    onUpdate({ ...couple, notes })
    setSavingNotes(false)
  }

  const saveDate = async () => {
    setSavingDate(true)
    const newDate = dateValue || '2099-01-01'
    await supabase.from('couples').update({ event_date: newDate }).eq('id', couple.id)
    onUpdate({ ...couple, event_date: newDate })
    setSavingDate(false)
    setEditingDate(false)
  }

  const coupleLink = `${window.location.origin}/couple/${couple.couple_link_token}`

  const phoneDigits = couple.phone?.replace(/\D/g, '') || ''
  const phoneForWa = phoneDigits.startsWith('0')
    ? '972' + phoneDigits.slice(1)
    : phoneDigits.startsWith('972')
    ? phoneDigits
    : '972' + phoneDigits

  const waMessage = encodeURIComponent(
    `שלום חמודים!\n\nשמחה להתחיל את המסע המשותף שלנו יחד.\nמפה אני איתכם בכל דבר!\n\nזה קובץ עבודה ייעודי שיעזור לנו להיות מסונכרנים לגבי מחירים וספקים.\n\nהלינק: ${coupleLink}\n\nזמינה בשבילכם לכל דבר`
  )

  const totalContract = vendors.reduce((s, v) => s + (v.contract_amount || 0), 0)
  const totalPaid = vendors.reduce((s, v) => s + (v.amount_paid || 0), 0)

  return (
    <div className="cp-page">
      {showContract && <ContractGenerator couple={couple} onClose={() => setShowContract(false)} />}
      <div className="cp-header">
        <div>
          <h2>{couple.couple_name || `${couple.partner1_name} ו${couple.partner2_name}`}</h2>
          <div className="cp-header-meta">
            {couple.phone && <span className="cp-phone">📞 {couple.phone}</span>}
            {editingDate ? (
              <div className="cp-date-edit">
                <input
                  className="cp-date-input"
                  type="date"
                  value={dateValue}
                  onChange={e => setDateValue(e.target.value)}
                  autoFocus
                />
                <button className="cp-date-save" onClick={saveDate} disabled={savingDate}>
                  {savingDate ? '...' : '✓ שמור'}
                </button>
                <button className="cp-date-cancel" onClick={() => setEditingDate(false)}>ביטול</button>
              </div>
            ) : (
              <span
                className="cp-event-date-badge"
                onClick={() => setEditingDate(true)}
                title="לחץ לעריכת תאריך"
              >
                {couple.event_date && couple.event_date !== '2099-01-01' ? (() => {
                  const d = new Date(couple.event_date)
                  const today = new Date(); today.setHours(0,0,0,0)
                  const days = Math.ceil((d.getTime() - today.getTime()) / (1000*60*60*24))
                  const dateStr = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
                  return <>
                    📅 {dateStr}
                    <span className="cp-days-badge" style={{ background: days <= 30 ? '#e63946' : days <= 90 ? '#f8961e' : '#6c63ff' }}>
                      {days <= 0 ? '🎉 היום!' : days === 1 ? 'מחר' : `עוד ${days} ימים`}
                    </span>
                    <span className="cp-date-edit-hint">✏️</span>
                  </>
                })() : <span className="cp-no-date-badge">📅 הוסף תאריך חתונה ✏️</span>}
              </span>
            )}
          </div>
        </div>
        <div className="cp-header-actions">
          <select
            className="cp-status-select"
            value={couple.status || 'מתלבטים'}
            style={{ borderColor: STATUS_COLORS[couple.status || 'מתלבטים'] }}
            onChange={e => onStatusChange(e.target.value)}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="cp-delete-btn" onClick={handleDeleteCouple}>🗑 מחק זוג</button>
        </div>
      </div>

      <div className="cp-grid">
        <div className="cp-card">
          <h3>פרטי הזוג</h3>
          <div className="cp-info-grid">
            {couple.partner1_name && <div className="cp-info-item"><label>שם פרטי 1</label><span>{couple.partner1_name} {(couple as any).partner1_last_name || ''}</span></div>}
            {couple.partner2_name && <div className="cp-info-item"><label>שם פרטי 2</label><span>{couple.partner2_name} {(couple as any).partner2_last_name || ''}</span></div>}
            {(couple as any).partner1_id && <div className="cp-info-item"><label>ת.ז. 1</label><span>{(couple as any).partner1_id}</span></div>}
            {(couple as any).partner2_id && <div className="cp-info-item"><label>ת.ז. 2</label><span>{(couple as any).partner2_id}</span></div>}
            {couple.partner1_age && <div className="cp-info-item"><label>גיל 1</label><span>{couple.partner1_age}</span></div>}
            {couple.partner2_age && <div className="cp-info-item"><label>גיל 2</label><span>{couple.partner2_age}</span></div>}
            {couple.how_met && <div className="cp-info-item cp-info-full"><label>איפה הכירו</label><span>{couple.how_met}</span></div>}
            {couple.estimated_guests && <div className="cp-info-item"><label>כמות אורחים מוערך</label><span>{couple.estimated_guests}</span></div>}
            {couple.budget > 0 && <div className="cp-info-item"><label>תקציב</label><span>₪{couple.budget.toLocaleString()}</span></div>}
            {couple.has_venue && couple.venue_name && <div className="cp-info-item cp-info-full"><label>מקום</label><span>{couple.venue_name} {couple.venue_cost ? `— ₪${Number(couple.venue_cost).toLocaleString()}` : ''}</span></div>}
            {couple.important_vendors && <div className="cp-info-item cp-info-full"><label>מה הכי חשוב להם</label><span>{couple.important_vendors}</span></div>}
            {couple.wedding_vision && <div className="cp-info-item cp-info-full"><label>חזון החתונה</label><span>{couple.wedding_vision}</span></div>}
            {(couple as any).producer_role_vision && <div className="cp-info-item cp-info-full"><label>תפיסת תפקיד מפיקה</label><span>{(couple as any).producer_role_vision}</span></div>}
          </div>
        </div>

        <div className="cp-card cp-card-financial">
          <h3>סיכום כלכלי</h3>
          <div className="cp-financial-row">
            <div className="cp-fin-item">
              <label>תקציב</label>
              <span>₪{(couple.budget || 0).toLocaleString()}</span>
            </div>
            <div className="cp-fin-item">
              <label>סה"כ חוזים</label>
              <span>₪{totalContract.toLocaleString()}</span>
            </div>
            <div className="cp-fin-item">
              <label>שולם</label>
              <span className="paid">₪{totalPaid.toLocaleString()}</span>
            </div>
            <div className="cp-fin-item">
              <label>יתרה</label>
              <span className={totalContract - totalPaid > 0 ? 'due' : 'paid'}>
                ₪{(totalContract - totalPaid).toLocaleString()}
              </span>
            </div>
          </div>
          {couple.budget > 0 && (
            <div className="cp-budget-bar-wrap">
              <div className="cp-budget-bar">
                <div className="cp-budget-fill" style={{ width: `${Math.min((totalContract / couple.budget) * 100, 100)}%` }} />
              </div>
              <span>{Math.round((totalContract / couple.budget) * 100)}% מהתקציב נוצל</span>
            </div>
          )}
        </div>
      </div>

      <div className="cp-card">
        <h3>הערות פנימיות (נראות רק לשיר)</h3>
        <textarea className="cp-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="הערות, מחשבות, תזכורות..." />
        <button className="cp-save-btn" onClick={saveNotes} disabled={savingNotes}>
          {savingNotes ? 'שומר...' : 'שמור הערות'}
        </button>
      </div>

      {/* Tasks per couple */}
      <div className="cp-card">
        <h3>משימות לחתונה ✅</h3>
        <form className="cp-task-form" onSubmit={addTask}>
          <input
            className="cp-task-input"
            placeholder="משימה חדשה..."
            value={taskInput}
            onChange={e => setTaskInput(e.target.value)}
          />
          <input
            className="cp-task-date"
            type="date"
            value={taskDue}
            onChange={e => setTaskDue(e.target.value)}
          />
          <select
            className="cp-task-priority"
            value={taskPriority}
            onChange={e => setTaskPriority(e.target.value as Task['priority'])}
          >
            <option value="high">🔴 דחוף</option>
            <option value="normal">🟡 רגיל</option>
            <option value="low">🟢 נמוך</option>
          </select>
          <button className="cp-task-add-btn" type="submit" disabled={addingTask}>
            {addingTask ? '...' : '+ הוסף'}
          </button>
        </form>
        {tasks.length === 0 && <p className="cp-no-docs">אין משימות עדיין</p>}
        <div className="cp-tasks-list">
          {tasks.map(task => (
            <div key={task.id} className={`cp-task-row ${task.is_done ? 'cp-task-done' : ''} ${isOverdue(task) ? 'cp-task-overdue' : ''}`}>
              <button className="cp-task-check" onClick={() => toggleTask(task)}>
                {task.is_done ? '✓' : ''}
              </button>
              <span className="cp-task-title">{task.title}</span>
              {task.due_date && (
                <span className={`cp-task-due ${isOverdue(task) ? 'cp-due-overdue' : ''}`}>
                  {formatTaskDate(task.due_date)}{isOverdue(task) ? ' — באיחור!' : ''}
                </span>
              )}
              <button className="cp-task-delete" onClick={() => deleteTask(task.id)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="cp-card cp-link-card">
        <h3>לינק אישי לזוג 🔗</h3>
        <p>שלחי לינק זה לזוג לעבודה משותפת על דף הספקים:</p>
        <button className="cp-contract-btn" onClick={() => setShowContract(true)}>✍️ צור חוזה</button>
        <div className="cp-link-row">
          <input className="cp-link-input" readOnly value={coupleLink} />
          <button className="cp-copy-btn" onClick={() => { navigator.clipboard.writeText(coupleLink); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000) }}>
            {copiedLink ? '✓ הועתק' : 'העתק'}
          </button>
          <a
            href={`https://wa.me/${phoneForWa}?text=${waMessage}`}
            target="_blank"
            rel="noreferrer"
            className="cp-wa-btn"
          >
            💬 שלחי בוואטסאפ
          </a>
        </div>
      </div>

      <div className="cp-card">
        <h3>דף עבודה — ספקים</h3>
        <VendorWorksheet
          weddingId={couple.id}
          estimatedGuests={couple.estimated_guests || couple.guest_count || 0}
          vendors={vendors}
          onVendorsChange={setVendors}
          readOnly={false}
        />
      </div>

      {/* Sketch / inspiration image */}
      <div className="cp-card">
        <h3>סקיצה ותמונת השראה 🎨</h3>
        {!sketch ? (
          <>
            <label className="cp-upload-btn">
              {uploadingSketch ? 'מעלה...' : '+ העלה תמונה/סקיצה'}
              <input type="file" hidden accept=".jpg,.jpeg,.png,.gif,.webp" onChange={handleSketchUpload} />
            </label>
            <p className="cp-no-docs">אין סקיצה עדיין</p>
          </>
        ) : (
          <div className="cp-sketch-wrap">
            <img
              src={sketch.url}
              alt="סקיצה"
              className="cp-sketch-thumb"
              onClick={() => setLightboxOpen(true)}
            />
            <div className="cp-sketch-actions">
              <button className="cp-sketch-expand-btn" onClick={() => setLightboxOpen(true)}>🔍 הגדל</button>
              <label className="cp-upload-btn" style={{ marginBottom: 0 }}>
                {uploadingSketch ? 'מעלה...' : '🔄 החלף'}
                <input type="file" hidden accept=".jpg,.jpeg,.png,.gif,.webp" onChange={handleSketchUpload} />
              </label>
            </div>
            <p className="cp-sketch-name">{sketch.name}</p>
          </div>
        )}
        {lightboxOpen && sketch && (
          <div className="cp-lightbox" onClick={() => setLightboxOpen(false)}>
            <button className="cp-lightbox-close" onClick={e => { e.stopPropagation(); setLightboxOpen(false) }}>✕</button>
            <img src={sketch.url} alt="סקיצה מוגדלת" className="cp-lightbox-img" onClick={e => e.stopPropagation()} />
          </div>
        )}
      </div>

      <div className="cp-card">
        <h3>מסמכים וחוזות 📁</h3>

        <div className="cp-doc-zone">
          <h4>הצעות מחיר</h4>
          <label className="cp-upload-btn">
            {uploadingDoc === 'quotes' ? 'מעלה...' : '+ העלה הצעת מחיר'}
            <input type="file" hidden onChange={e => handleDocUpload(e, 'quotes')} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
          </label>
          {documents.filter(d => d.doc_zone === 'quotes' || !d.doc_zone).length === 0 && <p className="cp-no-docs">אין הצעות מחיר עדיין</p>}
          <div className="cp-docs-list">
            {documents.filter(d => d.doc_zone === 'quotes' || !d.doc_zone).map(doc => (
              <div key={doc.id} className="cp-doc-item">
                <a href={doc.file_url} target="_blank" rel="noreferrer">📄 {doc.file_name}</a>
                <button onClick={() => handleDeleteDoc(doc.id, doc.file_url)}>מחק</button>
              </div>
            ))}
          </div>
        </div>

        {documents.filter(d => d.doc_zone === 'pending_signature').length > 0 && (
          <div className="cp-doc-zone cp-doc-zone-pending" style={{ marginTop: 16 }}>
            <h4>⏳ ממתין לחתימת הזוג</h4>
            <p className="cp-doc-pending-hint">החוזה נשלח לזוג — מחכה לחתימתם.</p>
            <div className="cp-docs-list">
              {documents.filter(d => d.doc_zone === 'pending_signature').map(doc => (
                <div key={doc.id} className="cp-doc-item">
                  <a href={doc.file_url} target="_blank" rel="noreferrer">📄 {doc.file_name}</a>
                  <button onClick={() => handleDeleteDoc(doc.id, doc.file_url)}>מחק</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="cp-doc-zone" style={{ marginTop: 16 }}>
          <h4>חוזים חתומים</h4>
          <label className="cp-upload-btn">
            {uploadingDoc === 'contracts' ? 'מעלה...' : '+ העלה חוזה'}
            <input type="file" hidden onChange={e => handleDocUpload(e, 'contracts')} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
          </label>
          {documents.filter(d => d.doc_zone === 'contracts').length === 0 && <p className="cp-no-docs">אין חוזים עדיין</p>}
          <div className="cp-docs-list">
            {documents.filter(d => d.doc_zone === 'contracts').map(doc => (
              <div key={doc.id} className="cp-doc-item">
                <a href={doc.file_url} target="_blank" rel="noreferrer">📄 {doc.file_name}</a>
                <button onClick={() => handleDeleteDoc(doc.id, doc.file_url)}>מחק</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
