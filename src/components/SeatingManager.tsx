import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/SeatingManager.css'

const CATEGORIES = [
  'חברים הורי כלה',
  'חברים הורי חתן',
  'חברים כלה',
  'חברים חתן',
  'חברים משותפים',
  'משפחה חתן',
  'משפחה כלה',
]

interface Guest {
  id: string
  full_name: string
  phone: string
  party_size: number
  table_id: string | null
  notes: string
  category: string
}

interface SeatingTable {
  id: string
  table_number: number
  table_name: string
  seats: number
}

interface TableGroup {
  seats: number
  count: string
}

interface Props {
  weddingId: string
  readOnly?: boolean
}

function parseGuestText(text: string): Omit<Guest, 'id' | 'table_id' | 'category'>[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    const parts = line.split(/\t|,/).map(p => p.trim())
    const full_name = parts[0] || ''
    let phone = ''
    let party_size = 1
    let notes = ''
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i]
      if (/^0\d{7,9}$/.test(p.replace(/[-\s]/g, ''))) {
        phone = p
      } else if (/^\d{1,2}$/.test(p)) {
        party_size = parseInt(p) || 1
      } else if (p) {
        notes = p
      }
    }
    return { full_name, phone, party_size, notes }
  }).filter(g => g.full_name)
}

export const SeatingManager: React.FC<Props> = ({ weddingId, readOnly = false }) => {
  const [guests, setGuests] = useState<Guest[]>([])
  const [tables, setTables] = useState<SeatingTable[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'guests' | 'tables' | 'seating'>('guests')
  const [error, setError] = useState('')

  // Paste
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [parsing, setParsing] = useState(false)

  // Add manually
  const [showAddGuest, setShowAddGuest] = useState(false)
  const [newGuest, setNewGuest] = useState({ full_name: '', phone: '', party_size: '1', notes: '', category: '' })
  const [saving, setSaving] = useState(false)

  // Table groups setup: array of {seats, count}
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([{ seats: 10, count: '' }])
  const [editingTables, setEditingTables] = useState(false)
  const [tableEdits, setTableEdits] = useState<SeatingTable[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [filterTable, setFilterTable] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [sortBy, setSortBy] = useState<'name' | 'category'>('name')

  // Custom categories (added by user)
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [newCatInput, setNewCatInput] = useState('')

  // Collapse guest list
  const [guestListCollapsed, setGuestListCollapsed] = useState(false)

  useEffect(() => { fetchAll() }, [weddingId])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: g, error: ge }, { data: t, error: te }] = await Promise.all([
      supabase.from('guests').select('*').eq('wedding_id', weddingId).order('full_name'),
      supabase.from('seating_tables').select('*').eq('wedding_id', weddingId).order('table_number'),
    ])
    if (ge) setError('שגיאה בטעינת אורחים: ' + ge.message)
    if (te) setError('שגיאה בטעינת שולחנות: ' + te.message)
    setGuests(g || [])
    setTables(t || [])
    setLoading(false)
  }

  const allCategories = [...CATEGORIES, ...customCategories]

  // ── Paste import ──────────────────────────────────────
  const handlePaste = async () => {
    const parsed = parseGuestText(pasteText)
    if (!parsed.length) { setError('לא זוהו שורות תקינות'); return }
    setParsing(true)
    setError('')
    const rows = parsed.map(g => ({
      wedding_id: weddingId,
      full_name: g.full_name,
      phone: g.phone || '',
      party_size: g.party_size,
      notes: g.notes || '',
      category: '',
      table_id: null,
    }))
    const { error: err } = await supabase.from('guests').insert(rows)
    if (err) {
      setError('שגיאה בייבוא: ' + err.message)
    } else {
      setPasteText('')
      setShowPaste(false)
    }
    setParsing(false)
    fetchAll()
  }

  // ── Add manually ─────────────────────────────────────
  const handleAddGuest = async () => {
    if (!newGuest.full_name.trim()) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('guests').insert([{
      wedding_id: weddingId,
      full_name: newGuest.full_name.trim(),
      phone: newGuest.phone.trim(),
      party_size: parseInt(newGuest.party_size) || 1,
      notes: newGuest.notes.trim(),
      category: newGuest.category,
      table_id: null,
    }])
    if (err) setError('שגיאה בהוספה: ' + err.message)
    else setNewGuest({ full_name: '', phone: '', party_size: '1', notes: '', category: '' })
    setSaving(false)
    setShowAddGuest(false)
    fetchAll()
  }

  const handleDeleteGuest = async (id: string) => {
    await supabase.from('guests').delete().eq('id', id)
    setGuests(prev => prev.filter(g => g.id !== id))
  }

  const handleAssignTable = async (guestId: string, tableId: string | null) => {
    await supabase.from('guests').update({ table_id: tableId }).eq('id', guestId)
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, table_id: tableId } : g))
  }

  const handlePartySizeChange = async (guestId: string, size: number) => {
    const s = Math.max(1, size)
    await supabase.from('guests').update({ party_size: s }).eq('id', guestId)
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, party_size: s } : g))
  }

  const handleCategoryChange = async (guestId: string, category: string) => {
    await supabase.from('guests').update({ category }).eq('id', guestId)
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, category } : g))
  }

  // ── Tables: generate from groups ─────────────────────
  const handleGenerateTables = async () => {
    const valid = tableGroups.filter(g => parseInt(g.count) > 0 && parseInt(g.seats) > 0)
    if (!valid.length) return
    setSaving(true)
    setError('')
    await supabase.from('seating_tables').delete().eq('wedding_id', weddingId)
    const rows: { wedding_id: string; table_number: number; table_name: string; seats: number }[] = []
    let num = 1
    for (const grp of valid) {
      const cnt = parseInt(grp.count)
      for (let i = 0; i < cnt; i++) {
        rows.push({ wedding_id: weddingId, table_number: num++, table_name: '', seats: parseInt(grp.seats.toString()) })
      }
    }
    const { error: err } = await supabase.from('seating_tables').insert(rows)
    if (err) setError('שגיאה ביצירת שולחנות: ' + err.message)
    setSaving(false)
    fetchAll()
  }

  const startEditTables = () => { setTableEdits([...tables]); setEditingTables(true) }
  const saveTableEdits = async () => {
    setSaving(true)
    await Promise.all(tableEdits.map(t =>
      supabase.from('seating_tables').update({ table_name: t.table_name, seats: t.seats }).eq('id', t.id)
    ))
    setSaving(false)
    setEditingTables(false)
    fetchAll()
  }

  // ── Print ────────────────────────────────────────────
  const handlePrint = () => {
    const sorted = [...guests].sort((a, b) => {
      const aLast = a.full_name.trim().split(' ').slice(-1)[0] || ''
      const bLast = b.full_name.trim().split(' ').slice(-1)[0] || ''
      return aLast.localeCompare(bLast, 'he')
    })
    const tableMap = Object.fromEntries(tables.map(t => [t.id, t]))
    const rows = sorted.map(g => {
      const tbl = g.table_id ? tableMap[g.table_id] : null
      const tableStr = tbl ? `${tbl.table_number}${tbl.table_name ? ` — ${tbl.table_name}` : ''}` : 'לא שובץ'
      const parts = g.full_name.trim().split(' ')
      const lastName = parts.length > 1 ? parts[parts.length - 1] : ''
      const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0]
      return `<tr><td><strong>${lastName}</strong></td><td>${firstName}</td><td style="text-align:center">${g.party_size}</td><td>${g.category || ''}</td><td style="text-align:center">${tableStr}</td><td>${g.phone || ''}</td></tr>`
    }).join('')
    const total = guests.reduce((s, g) => s + g.party_size, 0)
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>רשימת מוזמנים</title>
    <style>body{font-family:Arial,sans-serif;direction:rtl;padding:20px;font-size:13px}h2{font-size:18px;margin-bottom:4px}.meta{color:#888;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:8px 10px;text-align:right;border-bottom:2px solid #ddd;font-size:12px}td{padding:7px 10px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#fafafa}</style>
    </head><body>
    <h2>רשימת מוזמנים</h2>
    <div class="meta">סה״כ ${guests.length} רשומות · ${total} משתתפים</div>
    <table><thead><tr><th>שם משפחה</th><th>שם פרטי</th><th>כמות</th><th>קטגוריה</th><th>שולחן</th><th>טלפון</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <script>window.onload=()=>window.print()</script></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  // ── Derived ──────────────────────────────────────────
  const totalGuests = guests.reduce((s, g) => s + g.party_size, 0)
  const seated = guests.filter(g => g.table_id).reduce((s, g) => s + g.party_size, 0)
  const totalSeats = tables.reduce((s, t) => s + t.seats, 0)

  const filteredGuests = guests.filter(g => {
    const matchSearch = g.full_name.toLowerCase().includes(search.toLowerCase()) || g.phone.includes(search)
    const matchTable = filterTable === 'all' ? true : filterTable === 'unassigned' ? !g.table_id : g.table_id === filterTable
    const matchCat = filterCategory === 'all' ? true : g.category === filterCategory
    return matchSearch && matchTable && matchCat
  }).sort((a, b) => {
    if (sortBy === 'category') {
      const catA = a.category || 'ת'
      const catB = b.category || 'ת'
      if (catA !== catB) return catA.localeCompare(catB, 'he')
    }
    const aLast = a.full_name.trim().split(' ').slice(-1)[0] || ''
    const bLast = b.full_name.trim().split(' ').slice(-1)[0] || ''
    return aLast.localeCompare(bLast, 'he')
  })

  if (loading) return <div className="sm-loading">טוען...</div>

  return (
    <div className="sm-wrap">
      {error && <div className="sm-error">{error} <button onClick={() => setError('')}>✕</button></div>}

      {/* Stats */}
      <div className="sm-stats">
        <div className="sm-stat"><span className="sm-stat-val">{guests.length}</span><span className="sm-stat-label">רשומות</span></div>
        <div className="sm-stat"><span className="sm-stat-val">{totalGuests}</span><span className="sm-stat-label">משתתפים</span></div>
        <div className="sm-stat"><span className="sm-stat-val">{tables.length}</span><span className="sm-stat-label">שולחנות</span></div>
        <div className="sm-stat"><span className="sm-stat-val">{totalSeats > 0 ? totalSeats - seated : '—'}</span><span className="sm-stat-label">מקומות פנויים</span></div>
      </div>

      {/* Tabs */}
      <div className="sm-tabs">
        <button className={`sm-tab ${activeView === 'guests' ? 'active' : ''}`} onClick={() => setActiveView('guests')}>👥 אורחים</button>
        <button className={`sm-tab ${activeView === 'tables' ? 'active' : ''}`} onClick={() => setActiveView('tables')}>🪑 שולחנות</button>
        <button className={`sm-tab ${activeView === 'seating' ? 'active' : ''}`} onClick={() => setActiveView('seating')}>📋 שיבוץ</button>
      </div>

      {/* ── GUESTS ── */}
      {activeView === 'guests' && (
        <div className="sm-section">
          <div className="sm-section-header">
            <span className="sm-section-count">{guests.length} אורחים · {guests.reduce((s,g)=>s+g.party_size,0)} משתתפים</span>
            <button className="sm-collapse-btn" onClick={() => setGuestListCollapsed(p => !p)}>
              {guestListCollapsed ? '▼ הרחב רשימה' : '▲ מזער רשימה'}
            </button>
          </div>
          {!guestListCollapsed && !readOnly && (
            <div className="sm-actions-row">
              <button className="sm-btn-primary" onClick={() => { setShowPaste(!showPaste); setShowAddGuest(false) }}>📋 הדבקת רשימה</button>
              <button className="sm-btn-secondary" onClick={() => { setShowAddGuest(!showAddGuest); setShowPaste(false) }}>+ הוסף ידנית</button>
              <button className="sm-btn-print" onClick={handlePrint}>🖨️ הדפסה</button>
            </div>
          )}

          {!guestListCollapsed && (
            <>
              {/* Paste */}
              {showPaste && !readOnly && (
                <div className="sm-paste-box">
                  <p className="sm-paste-hint">הדבק מאקסל או גוגל שיטס — כל שורה: <strong>שם, טלפון, כמות</strong> (טלפון וכמות אופציונליים)</p>
                  <textarea className="sm-paste-area" rows={8}
                    placeholder={"ישראל ישראלי\t0501234567\t2\nשרה כהן\t0529876543\nמשה לוי"}
                    value={pasteText} onChange={e => setPasteText(e.target.value)} />
                  <div className="sm-paste-actions">
                    <button className="sm-btn-primary" onClick={handlePaste} disabled={parsing || !pasteText.trim()}>
                      {parsing ? 'מייבא...' : `ייבא ${parseGuestText(pasteText).length} אורחים`}
                    </button>
                    <button className="sm-btn-ghost" onClick={() => { setShowPaste(false); setPasteText('') }}>ביטול</button>
                  </div>
                </div>
              )}

              {/* Add manually */}
              {showAddGuest && !readOnly && (
                <div className="sm-add-form">
                  <div className="sm-add-row">
                    <input className="sm-input" placeholder="שם מלא *" value={newGuest.full_name} onChange={e => setNewGuest(p => ({ ...p, full_name: e.target.value }))} />
                    <input className="sm-input" placeholder="טלפון" value={newGuest.phone} onChange={e => setNewGuest(p => ({ ...p, phone: e.target.value }))} />
                    <input className="sm-input sm-input-sm" type="number" min="1" placeholder="כמות" value={newGuest.party_size} onChange={e => setNewGuest(p => ({ ...p, party_size: e.target.value }))} />
                  </div>
                  <select className="sm-select-full" value={newGuest.category} onChange={e => setNewGuest(p => ({ ...p, category: e.target.value }))}>
                    <option value="">— בחר קטגוריה —</option>
                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="sm-add-actions">
                    <button className="sm-btn-primary" onClick={handleAddGuest} disabled={saving || !newGuest.full_name.trim()}>{saving ? 'שומר...' : 'הוסף'}</button>
                    <button className="sm-btn-ghost" onClick={() => setShowAddGuest(false)}>ביטול</button>
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="sm-filter-row">
                <input className="sm-search" placeholder="חיפוש שם או טלפון..." value={search} onChange={e => setSearch(e.target.value)} />
                <select className="sm-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                  <option value="all">כל הקטגוריות</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="sm-select" value={filterTable} onChange={e => setFilterTable(e.target.value)}>
                  <option value="all">כל השולחנות</option>
                  <option value="unassigned">לא שובצו</option>
                  {tables.map(t => <option key={t.id} value={t.id}>שולחן {t.table_number}{t.table_name ? ` — ${t.table_name}` : ''}</option>)}
                </select>
                <select className="sm-select" value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'category')}>
                  <option value="name">מיון: שם</option>
                  <option value="category">מיון: קטגוריה</option>
                </select>
              </div>

              {/* Add custom category */}
              {!readOnly && (
                <div className="sm-custom-cat-row">
                  <input className="sm-input sm-input-cat" placeholder="+ קטגוריה חדשה" value={newCatInput} onChange={e => setNewCatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newCatInput.trim()) { setCustomCategories(p => [...p, newCatInput.trim()]); setNewCatInput('') }}} />
                  {newCatInput.trim() && (
                    <button className="sm-btn-secondary sm-btn-xs" onClick={() => { setCustomCategories(p => [...p, newCatInput.trim()]); setNewCatInput('') }}>הוסף</button>
                  )}
                </div>
              )}

              {/* Guest list — grouped by category if sorted by category */}
              <div className="sm-guest-list">
                {filteredGuests.length === 0 && <div className="sm-empty">אין אורחים תואמים</div>}
                {sortBy === 'category'
                  ? (() => {
                      const groups = new Map<string, Guest[]>()
                      filteredGuests.forEach(g => {
                        const key = g.category || 'ללא קטגוריה'
                        if (!groups.has(key)) groups.set(key, [])
                        groups.get(key)!.push(g)
                      })
                      return Array.from(groups.entries()).map(([cat, list]) => (
                        <div key={cat}>
                          <div className="sm-cat-header">{cat} <span className="sm-cat-count">{list.reduce((s,g)=>s+g.party_size,0)} משתתפים</span></div>
                          {list.map(g => <GuestRow key={g.id} g={g} tables={tables} guests={guests} readOnly={readOnly} allCategories={allCategories}
                            onDelete={handleDeleteGuest} onAssign={handleAssignTable} onPartySize={handlePartySizeChange} onCategory={handleCategoryChange} />)}
                        </div>
                      ))
                    })()
                  : filteredGuests.map(g => <GuestRow key={g.id} g={g} tables={tables} guests={guests} readOnly={readOnly} allCategories={allCategories}
                      onDelete={handleDeleteGuest} onAssign={handleAssignTable} onPartySize={handlePartySizeChange} onCategory={handleCategoryChange} />)
                }
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TABLES ── */}
      {activeView === 'tables' && (
        <div className="sm-section">
          {!readOnly && !editingTables && (
            <div className="sm-table-setup">
              <p className="sm-setup-hint">הגדר קבוצות שולחנות — אפשר להוסיף כמה קבוצות עם גדלים שונים</p>
              <div className="sm-groups-list">
                {tableGroups.map((grp, i) => (
                  <div key={i} className="sm-group-row">
                    <input className="sm-input sm-input-sm" type="number" min="1" placeholder="כמות" value={grp.count}
                      onChange={e => setTableGroups(prev => prev.map((g, j) => j === i ? { ...g, count: e.target.value } : g))} />
                    <span className="sm-group-label">שולחנות של</span>
                    <input className="sm-input sm-input-sm" type="number" min="1" placeholder="מקומות" value={grp.seats}
                      onChange={e => setTableGroups(prev => prev.map((g, j) => j === i ? { ...g, seats: e.target.value as any } : g))} />
                    <span className="sm-group-label">מקומות</span>
                    {tableGroups.length > 1 && (
                      <button className="sm-delete-btn" onClick={() => setTableGroups(prev => prev.filter((_, j) => j !== i))}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="sm-group-actions">
                <button className="sm-btn-secondary" onClick={() => setTableGroups(prev => [...prev, { seats: 10, count: '' }])}>+ הוסף קבוצה</button>
                <button className="sm-btn-primary" onClick={handleGenerateTables} disabled={saving}>
                  {saving ? 'יוצר...' : tables.length > 0 ? '🔄 עדכן שולחנות' : '✓ צור שולחנות'}
                </button>
              </div>
              {tables.length > 0 && (
                <button className="sm-btn-secondary" onClick={startEditTables} style={{ marginTop: 8 }}>✏️ ערוך שמות ומקומות</button>
              )}
            </div>
          )}

          {editingTables && !readOnly && (
            <div className="sm-table-edit">
              <div className="sm-table-edit-grid">
                {tableEdits.map((t, i) => (
                  <div key={t.id} className="sm-table-edit-row">
                    <span className="sm-table-num">שולחן {t.table_number}</span>
                    <input className="sm-input" placeholder='שם (למשל "משפחת חתן")' value={t.table_name}
                      onChange={e => setTableEdits(prev => prev.map((x, j) => j === i ? { ...x, table_name: e.target.value } : x))} />
                    <input className="sm-input sm-input-sm" type="number" min="1" value={t.seats}
                      onChange={e => setTableEdits(prev => prev.map((x, j) => j === i ? { ...x, seats: parseInt(e.target.value) || 1 } : x))} />
                  </div>
                ))}
              </div>
              <div className="sm-edit-actions">
                <button className="sm-btn-primary" onClick={saveTableEdits} disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
                <button className="sm-btn-ghost" onClick={() => setEditingTables(false)}>ביטול</button>
              </div>
            </div>
          )}

          {tables.length > 0 && !editingTables && (
            <div className="sm-tables-grid">
              {tables.map(t => {
                const assigned = guests.filter(g => g.table_id === t.id)
                const takenSeats = assigned.reduce((s, g) => s + g.party_size, 0)
                const pct = Math.min(100, Math.round((takenSeats / t.seats) * 100))
                return (
                  <div key={t.id} className={`sm-table-card ${takenSeats > t.seats ? 'over' : takenSeats === t.seats ? 'full' : ''}`}>
                    <div className="sm-table-card-header">
                      <span className="sm-table-card-num">שולחן {t.table_number}</span>
                      <span className="sm-table-card-seats">{takenSeats}/{t.seats}</span>
                    </div>
                    {t.table_name && <div className="sm-table-card-name">{t.table_name}</div>}
                    <div className="sm-table-bar"><div className="sm-table-bar-fill" style={{ width: `${pct}%`, background: takenSeats > t.seats ? '#e63946' : takenSeats === t.seats ? '#90be6d' : '#6c63ff' }} /></div>
                    <div className="sm-table-names">
                      {assigned.map(g => <span key={g.id} className="sm-table-guest-chip">{g.full_name}{g.party_size > 1 ? ` (${g.party_size})` : ''}</span>)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {tables.length === 0 && <div className="sm-empty">עדיין לא הוגדרו שולחנות</div>}
        </div>
      )}

      {/* ── SEATING ── */}
      {activeView === 'seating' && (
        <div className="sm-section">
          <div className="sm-seating-header">
            <span className="sm-seating-stat">{guests.filter(g => !g.table_id).length} אורחים לא שובצו</span>
            <button className="sm-btn-print" onClick={handlePrint}>🖨️ הדפסה</button>
          </div>
          <div className="sm-seating-list">
            {guests.filter(g => !g.table_id).map(g => (
              <div key={g.id} className="sm-seating-row">
                <div className="sm-seating-info">
                  <span className="sm-guest-name">{g.full_name}</span>
                  {g.category && <span className="sm-cat-badge">{g.category}</span>}
                </div>
                <span className="sm-party-badge">{g.party_size}</span>
                {!readOnly && (
                  <select className="sm-table-select" value="" onChange={e => handleAssignTable(g.id, e.target.value || null)}>
                    <option value="">בחר שולחן...</option>
                    {tables.map(t => {
                      const taken = guests.filter(x => x.table_id === t.id).reduce((s, x) => s + x.party_size, 0)
                      const free = t.seats - taken
                      return <option key={t.id} value={t.id} disabled={free <= 0}>
                        שולחן {t.table_number}{t.table_name ? ` — ${t.table_name}` : ''} ({free} פנוי)
                      </option>
                    })}
                  </select>
                )}
              </div>
            ))}
            {guests.filter(g => !g.table_id).length === 0 && <div className="sm-empty">🎉 כל האורחים שובצו!</div>}
          </div>

          {guests.filter(g => g.table_id).length > 0 && (
            <>
              <div className="sm-seating-divider">שובצו ({guests.filter(g => g.table_id).length})</div>
              <div className="sm-seating-list assigned">
                {guests.filter(g => g.table_id).map(g => {
                  const t = tables.find(x => x.id === g.table_id)
                  return (
                    <div key={g.id} className="sm-seating-row">
                      <div className="sm-seating-info">
                        <span className="sm-guest-name">{g.full_name}</span>
                        {g.category && <span className="sm-cat-badge">{g.category}</span>}
                      </div>
                      <span className="sm-party-badge">{g.party_size}</span>
                      <span className="sm-table-badge">שולחן {t?.table_number}{t?.table_name ? ` — ${t.table_name}` : ''}</span>
                      {!readOnly && <button className="sm-unassign-btn" onClick={() => handleAssignTable(g.id, null)}>הסר</button>}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── GuestRow sub-component ──────────────────────────────
const GuestRow: React.FC<{
  g: Guest
  tables: SeatingTable[]
  guests: Guest[]
  readOnly: boolean
  allCategories: string[]
  onDelete: (id: string) => void
  onAssign: (id: string, tableId: string | null) => void
  onPartySize: (id: string, size: number) => void
  onCategory: (id: string, cat: string) => void
}> = ({ g, tables, guests, readOnly, allCategories, onDelete, onAssign, onPartySize, onCategory }) => (
  <div className="sm-guest-row">
    <div className="sm-guest-info">
      <span className="sm-guest-name">{g.full_name}</span>
      {g.phone && <span className="sm-guest-phone">{g.phone}</span>}
    </div>
    <div className="sm-guest-controls">
      <div className="sm-party-control">
        <button onClick={() => onPartySize(g.id, g.party_size - 1)}>−</button>
        <span>{g.party_size}</span>
        <button onClick={() => onPartySize(g.id, g.party_size + 1)}>+</button>
      </div>
      {!readOnly && (
        <select className="sm-cat-select" value={g.category || ''} onChange={e => onCategory(g.id, e.target.value)}>
          <option value="">— קטגוריה —</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {!readOnly && (
        <select className="sm-table-select" value={g.table_id || ''} onChange={e => onAssign(g.id, e.target.value || null)}>
          <option value="">לא שובץ</option>
          {tables.map(t => {
            const taken = guests.filter(x => x.table_id === t.id).reduce((s, x) => s + x.party_size, 0)
            const free = t.seats - taken
            return <option key={t.id} value={t.id}>שולחן {t.table_number}{t.table_name ? ` — ${t.table_name}` : ''} ({free})</option>
          })}
        </select>
      )}
      {!readOnly && <button className="sm-delete-btn" onClick={() => onDelete(g.id)}>✕</button>}
    </div>
  </div>
)
