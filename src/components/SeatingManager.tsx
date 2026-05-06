import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/SeatingManager.css'

interface Guest {
  id: string
  full_name: string
  phone: string
  party_size: number
  table_id: string | null
  notes: string
}

interface SeatingTable {
  id: string
  table_number: number
  table_name: string
  seats: number
}

interface Props {
  weddingId: string
  readOnly?: boolean
}

function parseGuestText(text: string): Omit<Guest, 'id' | 'table_id'>[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.map(line => {
    // Split by tab (Excel copy) or comma
    const parts = line.split(/\t|,/).map(p => p.trim())
    const full_name = parts[0] || ''
    let phone = ''
    let party_size = 1
    let notes = ''

    for (let i = 1; i < parts.length; i++) {
      const p = parts[i]
      if (/^0\d{8,9}$/.test(p.replace(/[-\s]/g, ''))) {
        phone = p
      } else if (/^\d$/.test(p) || /^\d\s*(איש|אנשים|נפש)?$/.test(p)) {
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

  // Guest paste state
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [parsing, setParsing] = useState(false)

  // Table setup state
  const [tableCount, setTableCount] = useState('')
  const [defaultSeats, setDefaultSeats] = useState('10')
  const [editingTables, setEditingTables] = useState(false)
  const [tableEdits, setTableEdits] = useState<SeatingTable[]>([])

  // Add guest manually
  const [showAddGuest, setShowAddGuest] = useState(false)
  const [newGuest, setNewGuest] = useState({ full_name: '', phone: '', party_size: '1', notes: '' })
  const [saving, setSaving] = useState(false)

  // Search
  const [search, setSearch] = useState('')
  const [filterTable, setFilterTable] = useState<string>('all')

  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchAll() }, [weddingId])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: g }, { data: t }] = await Promise.all([
      supabase.from('guests').select('*').eq('wedding_id', weddingId).order('full_name'),
      supabase.from('seating_tables').select('*').eq('wedding_id', weddingId).order('table_number'),
    ])
    setGuests(g || [])
    setTables(t || [])
    setLoading(false)
  }

  // ── Guests ──────────────────────────────────────────
  const handlePaste = async () => {
    const parsed = parseGuestText(pasteText)
    if (!parsed.length) return
    setParsing(true)
    const rows = parsed.map(g => ({ ...g, wedding_id: weddingId, table_id: null }))
    await supabase.from('guests').insert(rows)
    setPasteText('')
    setShowPaste(false)
    setParsing(false)
    fetchAll()
  }

  const handleAddGuest = async () => {
    if (!newGuest.full_name.trim()) return
    setSaving(true)
    await supabase.from('guests').insert([{
      wedding_id: weddingId,
      full_name: newGuest.full_name.trim(),
      phone: newGuest.phone.trim(),
      party_size: parseInt(newGuest.party_size) || 1,
      notes: newGuest.notes.trim(),
      table_id: null,
    }])
    setNewGuest({ full_name: '', phone: '', party_size: '1', notes: '' })
    setShowAddGuest(false)
    setSaving(false)
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
    await supabase.from('guests').update({ party_size: size }).eq('id', guestId)
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, party_size: size } : g))
  }

  // ── Tables ──────────────────────────────────────────
  const handleGenerateTables = async () => {
    const count = parseInt(tableCount)
    if (!count || count < 1) return
    setSaving(true)
    // Delete existing tables
    await supabase.from('seating_tables').delete().eq('wedding_id', weddingId)
    const rows = Array.from({ length: count }, (_, i) => ({
      wedding_id: weddingId,
      table_number: i + 1,
      table_name: '',
      seats: parseInt(defaultSeats) || 10,
    }))
    await supabase.from('seating_tables').insert(rows)
    setSaving(false)
    fetchAll()
  }

  const startEditTables = () => {
    setTableEdits([...tables])
    setEditingTables(true)
  }

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
      const tableStr = tbl
        ? `${tbl.table_number}${tbl.table_name ? ` — ${tbl.table_name}` : ''}`
        : 'לא שובץ'
      return `<tr>
        <td>${g.full_name}</td>
        <td style="text-align:center">${g.party_size}</td>
        <td style="text-align:center">${tableStr}</td>
        <td>${g.phone || ''}</td>
      </tr>`
    }).join('')

    const total = guests.reduce((s, g) => s + g.party_size, 0)
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
    <title>רשימת מוזמנים</title>
    <style>
      body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; font-size: 13px; }
      h2 { font-size: 18px; margin-bottom: 4px; }
      .meta { color: #888; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f5f5f5; padding: 8px 10px; text-align: right; border-bottom: 2px solid #ddd; font-size: 12px; }
      td { padding: 7px 10px; border-bottom: 1px solid #eee; }
      tr:nth-child(even) td { background: #fafafa; }
      .footer { margin-top: 14px; font-size: 12px; color: #888; }
      @media print { button { display: none; } }
    </style></head><body>
    <h2>רשימת מוזמנים</h2>
    <div class="meta">סה״כ ${guests.length} רשומות · ${total} משתתפים</div>
    <table>
      <thead><tr><th>שם מלא</th><th>כמות</th><th>שולחן</th><th>טלפון</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">מודפס מתוך מערכת ניהול החתונות של שיר</div>
    <script>window.onload = () => window.print()</script>
    </body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  // ── Stats ─────────────────────────────────────────────
  const totalGuests = guests.reduce((s, g) => s + g.party_size, 0)
  const seated = guests.filter(g => g.table_id).reduce((s, g) => s + g.party_size, 0)
  const totalSeats = tables.reduce((s, t) => s + t.seats, 0)

  const filteredGuests = guests.filter(g => {
    const matchSearch = g.full_name.toLowerCase().includes(search.toLowerCase()) ||
      g.phone.includes(search)
    const matchTable = filterTable === 'all' ? true :
      filterTable === 'unassigned' ? !g.table_id :
      g.table_id === filterTable
    return matchSearch && matchTable
  })

  if (loading) return <div className="sm-loading">טוען...</div>

  return (
    <div className="sm-wrap">
      {/* Stats bar */}
      <div className="sm-stats">
        <div className="sm-stat">
          <span className="sm-stat-val">{guests.length}</span>
          <span className="sm-stat-label">רשומות</span>
        </div>
        <div className="sm-stat">
          <span className="sm-stat-val">{totalGuests}</span>
          <span className="sm-stat-label">משתתפים</span>
        </div>
        <div className="sm-stat">
          <span className="sm-stat-val">{tables.length}</span>
          <span className="sm-stat-label">שולחנות</span>
        </div>
        <div className="sm-stat">
          <span className="sm-stat-val">{totalSeats - seated > 0 ? totalSeats - seated : '—'}</span>
          <span className="sm-stat-label">מקומות פנויים</span>
        </div>
      </div>

      {/* View tabs */}
      <div className="sm-tabs">
        <button className={`sm-tab ${activeView === 'guests' ? 'active' : ''}`} onClick={() => setActiveView('guests')}>👥 אורחים</button>
        <button className={`sm-tab ${activeView === 'tables' ? 'active' : ''}`} onClick={() => setActiveView('tables')}>🪑 שולחנות</button>
        <button className={`sm-tab ${activeView === 'seating' ? 'active' : ''}`} onClick={() => setActiveView('seating')}>📋 שיבוץ</button>
      </div>

      {/* ── GUESTS VIEW ── */}
      {activeView === 'guests' && (
        <div className="sm-section">
          {!readOnly && (
            <div className="sm-actions-row">
              <button className="sm-btn-primary" onClick={() => setShowPaste(!showPaste)}>
                📋 הדבקת רשימה
              </button>
              <button className="sm-btn-secondary" onClick={() => setShowAddGuest(!showAddGuest)}>
                + הוסף ידנית
              </button>
              <button className="sm-btn-print" onClick={handlePrint}>
                🖨️ הדפסה
              </button>
            </div>
          )}

          {/* Paste area */}
          {showPaste && !readOnly && (
            <div className="sm-paste-box">
              <p className="sm-paste-hint">
                הדבק רשימה מאקסל או גוגל שיטס — כל שורה: <strong>שם, טלפון, כמות</strong> (טלפון וכמות אופציונליים)
              </p>
              <textarea
                className="sm-paste-area"
                rows={8}
                placeholder={"ישראל ישראלי, 0501234567, 2\nשרה כהן\nמשה לוי, 0529876543"}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <div className="sm-paste-actions">
                <button className="sm-btn-primary" onClick={handlePaste} disabled={parsing || !pasteText.trim()}>
                  {parsing ? 'מעבד...' : `ייבא ${parseGuestText(pasteText).length} אורחים`}
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
              <div className="sm-add-actions">
                <button className="sm-btn-primary" onClick={handleAddGuest} disabled={saving || !newGuest.full_name.trim()}>
                  {saving ? 'שומר...' : 'הוסף'}
                </button>
                <button className="sm-btn-ghost" onClick={() => setShowAddGuest(false)}>ביטול</button>
              </div>
            </div>
          )}

          {/* Search + filter */}
          <div className="sm-filter-row">
            <input className="sm-search" placeholder="חיפוש שם או טלפון..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="sm-select" value={filterTable} onChange={e => setFilterTable(e.target.value)}>
              <option value="all">כל האורחים</option>
              <option value="unassigned">לא שובצו</option>
              {tables.map(t => (
                <option key={t.id} value={t.id}>שולחן {t.table_number}{t.table_name ? ` — ${t.table_name}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Guest list */}
          <div className="sm-guest-list">
            {filteredGuests.length === 0 && (
              <div className="sm-empty">אין אורחים תואמים</div>
            )}
            {filteredGuests.map(g => {
              const assignedTable = tables.find(t => t.id === g.table_id)
              return (
                <div key={g.id} className="sm-guest-row">
                  <div className="sm-guest-info">
                    <span className="sm-guest-name">{g.full_name}</span>
                    {g.phone && <span className="sm-guest-phone">{g.phone}</span>}
                  </div>
                  <div className="sm-guest-controls">
                    <div className="sm-party-control">
                      <button onClick={() => handlePartySizeChange(g.id, Math.max(1, g.party_size - 1))}>−</button>
                      <span>{g.party_size}</span>
                      <button onClick={() => handlePartySizeChange(g.id, g.party_size + 1)}>+</button>
                    </div>
                    {!readOnly && (
                      <select
                        className="sm-table-select"
                        value={g.table_id || ''}
                        onChange={e => handleAssignTable(g.id, e.target.value || null)}
                      >
                        <option value="">לא שובץ</option>
                        {tables.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.table_number}{t.table_name ? ` — ${t.table_name}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {assignedTable && readOnly && (
                      <span className="sm-table-badge">שולחן {assignedTable.table_number}</span>
                    )}
                    {!readOnly && (
                      <button className="sm-delete-btn" onClick={() => handleDeleteGuest(g.id)}>✕</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TABLES VIEW ── */}
      {activeView === 'tables' && (
        <div className="sm-section">
          {!readOnly && !editingTables && (
            <div className="sm-table-setup">
              <p className="sm-setup-hint">הגדר את מספר השולחנות וכמות המקומות בכל שולחן</p>
              <div className="sm-setup-row">
                <div className="sm-setup-group">
                  <label>מספר שולחנות</label>
                  <input className="sm-input sm-input-sm" type="number" min="1" value={tableCount} onChange={e => setTableCount(e.target.value)} placeholder="20" />
                </div>
                <div className="sm-setup-group">
                  <label>מקומות בכל שולחן</label>
                  <input className="sm-input sm-input-sm" type="number" min="1" value={defaultSeats} onChange={e => setDefaultSeats(e.target.value)} placeholder="10" />
                </div>
                <button className="sm-btn-primary" onClick={handleGenerateTables} disabled={saving || !tableCount}>
                  {saving ? 'יוצר...' : tables.length > 0 ? 'עדכן שולחנות' : 'צור שולחנות'}
                </button>
              </div>
              {tables.length > 0 && (
                <button className="sm-btn-secondary" onClick={startEditTables} style={{ marginTop: 12 }}>
                  ✏️ ערוך שמות ומקומות
                </button>
              )}
            </div>
          )}

          {/* Edit table names */}
          {editingTables && !readOnly && (
            <div className="sm-table-edit">
              <div className="sm-table-edit-grid">
                {tableEdits.map((t, i) => (
                  <div key={t.id} className="sm-table-edit-row">
                    <span className="sm-table-num">שולחן {t.table_number}</span>
                    <input
                      className="sm-input"
                      placeholder='שם (למשל "משפחת חתן")'
                      value={t.table_name}
                      onChange={e => setTableEdits(prev => prev.map((x, j) => j === i ? { ...x, table_name: e.target.value } : x))}
                    />
                    <input
                      className="sm-input sm-input-sm"
                      type="number" min="1"
                      value={t.seats}
                      onChange={e => setTableEdits(prev => prev.map((x, j) => j === i ? { ...x, seats: parseInt(e.target.value) || 1 } : x))}
                    />
                  </div>
                ))}
              </div>
              <div className="sm-edit-actions">
                <button className="sm-btn-primary" onClick={saveTableEdits} disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
                <button className="sm-btn-ghost" onClick={() => setEditingTables(false)}>ביטול</button>
              </div>
            </div>
          )}

          {/* Tables overview */}
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
                    <div className="sm-table-bar">
                      <div className="sm-table-bar-fill" style={{ width: `${pct}%`, background: takenSeats > t.seats ? '#e63946' : takenSeats === t.seats ? '#90be6d' : '#6c63ff' }} />
                    </div>
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

      {/* ── SEATING VIEW — quick assign ── */}
      {activeView === 'seating' && (
        <div className="sm-section">
          <div className="sm-seating-header">
            <span className="sm-seating-stat">
              {guests.filter(g => !g.table_id).length} אורחים לא שובצו
            </span>
            <button className="sm-btn-print" onClick={handlePrint}>🖨️ הדפסה</button>
          </div>
          <div className="sm-seating-list">
            {guests.filter(g => !g.table_id).map(g => (
              <div key={g.id} className="sm-seating-row">
                <span className="sm-guest-name">{g.full_name}</span>
                <span className="sm-party-badge">{g.party_size}</span>
                {!readOnly && (
                  <select
                    className="sm-table-select"
                    value=""
                    onChange={e => handleAssignTable(g.id, e.target.value || null)}
                  >
                    <option value="">בחר שולחן...</option>
                    {tables.map(t => {
                      const taken = guests.filter(x => x.table_id === t.id).reduce((s, x) => s + x.party_size, 0)
                      const free = t.seats - taken
                      return (
                        <option key={t.id} value={t.id} disabled={free <= 0}>
                          שולחן {t.table_number}{t.table_name ? ` — ${t.table_name}` : ''} ({free} פנוי)
                        </option>
                      )
                    })}
                  </select>
                )}
              </div>
            ))}
            {guests.filter(g => !g.table_id).length === 0 && (
              <div className="sm-empty">🎉 כל האורחים שובצו!</div>
            )}
          </div>

          {/* Already assigned */}
          {guests.filter(g => g.table_id).length > 0 && (
            <>
              <div className="sm-seating-divider">שובצו ({guests.filter(g => g.table_id).length})</div>
              <div className="sm-seating-list assigned">
                {guests.filter(g => g.table_id).map(g => {
                  const t = tables.find(x => x.id === g.table_id)
                  return (
                    <div key={g.id} className="sm-seating-row">
                      <span className="sm-guest-name">{g.full_name}</span>
                      <span className="sm-party-badge">{g.party_size}</span>
                      <span className="sm-table-badge">שולחן {t?.table_number}{t?.table_name ? ` — ${t.table_name}` : ''}</span>
                      {!readOnly && (
                        <button className="sm-unassign-btn" onClick={() => handleAssignTable(g.id, null)}>הסר</button>
                      )}
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
