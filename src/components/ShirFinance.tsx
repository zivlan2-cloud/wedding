import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Couple, Vendor } from '../types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import '../styles/ShirFinance.css'

interface ShirFinanceProps {
  couples: Couple[]
}

interface Payment {
  amount: string
  date: string
  method: string
  includes_vat: boolean
}

interface CoupleRow {
  couple: Couple
  fee: number
  paid: number
  balance: number
  nextPaymentDate: string | null
}

interface MonthBar {
  month: string
  fee: number
}

const SHIR_CATEGORY = 'הפקה (אני 😊)'
const SHIR_CATEGORY_ALT = 'הפקה'

function isShirVendor(v: Vendor): boolean {
  return v.category === SHIR_CATEGORY || v.category === SHIR_CATEGORY_ALT
}

function calcVendorPaid(v: Vendor): number {
  if ((v as any).payments) {
    try {
      const pmts = typeof (v as any).payments === 'string'
        ? JSON.parse((v as any).payments)
        : (v as any).payments
      if (Array.isArray(pmts) && pmts.length > 0) {
        return pmts.reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0)
      }
    } catch {}
  }
  return v.amount_paid || 0
}

interface ManualWedding {
  id: string
  name: string
  fee: number
  paid: number
  event_date: string
}

function getNextPaymentDate(vendor: Vendor): string | null {
  if (!vendor.payments) return null
  try {
    const payments: Payment[] = typeof vendor.payments === 'string'
      ? JSON.parse(vendor.payments)
      : vendor.payments
    const today = new Date().toISOString().split('T')[0]
    const future = payments
      .map(p => p.date)
      .filter(d => d && d >= today)
      .sort()
    return future[0] || null
  } catch {
    return null
  }
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function monthKey(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' })
}

const CHAMPAGNE = '#c9a07a'
const CHAMPAGNE_LIGHT = '#f5ede3'

export const ShirFinance: React.FC<ShirFinanceProps> = ({ couples }) => {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [manualWeddings, setManualWeddings] = useState<ManualWedding[]>([])
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualForm, setManualForm] = useState({ name: '', fee: '', paid: '', event_date: '' })

  const activeCouples = couples.filter(c => c.status === 'פעילים')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('shir_manual_weddings')
      if (saved) setManualWeddings(JSON.parse(saved))
    } catch {}
  }, [])

  const addManualWedding = () => {
    if (!manualForm.name || !manualForm.fee) return
    const entry: ManualWedding = {
      id: Date.now().toString(),
      name: manualForm.name,
      fee: parseFloat(manualForm.fee) || 0,
      paid: parseFloat(manualForm.paid) || 0,
      event_date: manualForm.event_date,
    }
    const updated = [...manualWeddings, entry]
    setManualWeddings(updated)
    localStorage.setItem('shir_manual_weddings', JSON.stringify(updated))
    setManualForm({ name: '', fee: '', paid: '', event_date: '' })
    setShowManualForm(false)
  }

  const removeManualWedding = (id: string) => {
    const updated = manualWeddings.filter(w => w.id !== id)
    setManualWeddings(updated)
    localStorage.setItem('shir_manual_weddings', JSON.stringify(updated))
  }

  useEffect(() => {
    fetchAllVendors()
  }, [couples])

  const fetchAllVendors = async () => {
    if (couples.length === 0) {
      setVendors([])
      setLoading(false)
      return
    }
    const ids = couples.map(c => c.id)
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .in('wedding_id', ids)
    setVendors(data || [])
    setLoading(false)
  }

  // Only הפקה vendors for active couples
  const activeIds = new Set(activeCouples.map(c => c.id))
  const shirVendors = vendors.filter(v => isShirVendor(v) && activeIds.has(v.wedding_id))

  const manualTotalFee = manualWeddings.reduce((s, w) => s + w.fee, 0)
  const manualTotalPaid = manualWeddings.reduce((s, w) => s + w.paid, 0)

  const totalFee = shirVendors.reduce((s, v) => s + (v.contract_amount || 0), 0) + manualTotalFee
  const totalPaid = shirVendors.reduce((s, v) => s + calcVendorPaid(v), 0) + manualTotalPaid
  const totalBalance = totalFee - totalPaid
  const activeCount = activeCouples.length

  // Build couple rows
  const coupleRows: CoupleRow[] = activeCouples.map(couple => {
    const cv = shirVendors.filter(v => v.wedding_id === couple.id)
    const fee = cv.reduce((s, v) => s + (v.contract_amount || 0), 0)
    const paid = cv.reduce((s, v) => s + calcVendorPaid(v), 0)
    const balance = fee - paid
    const nextPaymentDate = cv.reduce<string | null>((best, v) => {
      const d = getNextPaymentDate(v)
      if (!d) return best
      if (!best || d < best) return d
      return best
    }, null)
    return { couple, fee, paid, balance, nextPaymentDate }
  }).sort((a, b) => {
    // Sort by next payment date ascending, nulls last
    if (!a.nextPaymentDate && !b.nextPaymentDate) return 0
    if (!a.nextPaymentDate) return 1
    if (!b.nextPaymentDate) return -1
    return a.nextPaymentDate.localeCompare(b.nextPaymentDate)
  })

  // Monthly chart data
  const monthMap: Record<string, number> = {}
  activeCouples.forEach(couple => {
    if (!couple.event_date) return
    const key = monthKey(couple.event_date)
    if (!key) return
    const cv = shirVendors.filter(v => v.wedding_id === couple.id)
    const fee = cv.reduce((s, v) => s + (v.contract_amount || 0), 0)
    monthMap[key] = (monthMap[key] || 0) + fee
  })

  // Sort months chronologically
  const monthData: MonthBar[] = Object.entries(monthMap)
    .map(([month, fee]) => ({ month, fee }))
    .sort((a, b) => a.month.localeCompare(b.month))

  if (loading) {
    return <div className="sf-loading">טוען נתוני פיננסים...</div>
  }

  return (
    <div className="sf-page" dir="rtl">
      <div className="sf-title-row">
        <h2 className="sf-title">פיננסים — שכ"ט שיר</h2>
        <span className="sf-subtitle">נתוני הכנסות ותשלומים לפי זוגות פעילים</span>
      </div>

      {/* KPI Row */}
      <div className="sf-kpi-row">
        <div className="sf-kpi-card">
          <span className="sf-kpi-value">₪{totalFee.toLocaleString('he-IL')}</span>
          <span className="sf-kpi-label">שכ"ט צפוי</span>
        </div>
        <div className="sf-kpi-card sf-kpi-green">
          <span className="sf-kpi-value">₪{totalPaid.toLocaleString('he-IL')}</span>
          <span className="sf-kpi-label">התקבל</span>
        </div>
        <div className="sf-kpi-card sf-kpi-amber">
          <span className="sf-kpi-value">₪{totalBalance.toLocaleString('he-IL')}</span>
          <span className="sf-kpi-label">יתרה לגבייה</span>
        </div>
        <div className="sf-kpi-card sf-kpi-purple">
          <span className="sf-kpi-value">{activeCount}</span>
          <span className="sf-kpi-label">זוגות פעילים</span>
        </div>
      </div>

      {/* Payment Timeline Table */}
      <div className="sf-section">
        <h3 className="sf-section-title">לוח תשלומים לפי זוג</h3>
        {coupleRows.length === 0 ? (
          <p className="sf-empty">אין זוגות פעילים עם שכ"ט מוגדר</p>
        ) : (
          <div className="sf-table-wrap">
            <table className="sf-table">
              <thead>
                <tr>
                  <th>זוג</th>
                  <th>שכ"ט כולל</th>
                  <th>שולם</th>
                  <th>יתרה</th>
                  <th>התקדמות</th>
                  <th>תשלום הבא</th>
                </tr>
              </thead>
              <tbody>
                {coupleRows.map(row => {
                  const pct = row.fee > 0 ? Math.min(100, Math.round((row.paid / row.fee) * 100)) : 0
                  const name = row.couple.couple_name ||
                    `${row.couple.partner1_name} ו${row.couple.partner2_name}`
                  return (
                    <tr key={row.couple.id} className={row.fee === 0 ? 'sf-row-dim' : ''}>
                      <td className="sf-td-name">{name}</td>
                      <td className="sf-td-num">
                        {row.fee > 0 ? `₪${row.fee.toLocaleString('he-IL')}` : '—'}
                      </td>
                      <td className="sf-td-num sf-paid">
                        {row.paid > 0 ? `₪${row.paid.toLocaleString('he-IL')}` : '—'}
                      </td>
                      <td className={`sf-td-num ${row.balance > 0 ? 'sf-balance' : 'sf-balanced'}`}>
                        {row.fee > 0 ? `₪${row.balance.toLocaleString('he-IL')}` : '—'}
                      </td>
                      <td className="sf-td-bar">
                        {row.fee > 0 ? (
                          <div className="sf-bar-wrap">
                            <div className="sf-bar">
                              <div
                                className="sf-bar-fill"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="sf-bar-pct">{pct}%</span>
                          </div>
                        ) : <span className="sf-dim">—</span>}
                      </td>
                      <td className={`sf-td-date ${row.nextPaymentDate ? 'sf-next-date' : 'sf-dim'}`}>
                        {formatDate(row.nextPaymentDate)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly Chart */}
      <div className="sf-section">
        <h3 className="sf-section-title">הכנסות לפי חודש אירוע</h3>
        {monthData.length === 0 ? (
          <p className="sf-empty">אין נתוני תאריכים לתצוגה</p>
        ) : (
          <div className="sf-chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#888', fontFamily: 'inherit' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#aaa', fontFamily: 'inherit' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `₪${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [`₪${value.toLocaleString('he-IL')}`, 'שכ"ט']}
                  contentStyle={{
                    fontFamily: 'inherit',
                    borderRadius: 8,
                    border: `1px solid ${CHAMPAGNE}`,
                    direction: 'rtl',
                  }}
                />
                <Bar dataKey="fee" radius={[6, 6, 0, 0]}>
                  {monthData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i % 2 === 0 ? CHAMPAGNE : '#d4a0a0'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Manual past weddings */}
      <div className="sf-section">
        <h3 className="sf-section-title">חתונות ידניות (לפני האפליקציה)</h3>
        <button className="sf-add-manual-btn" onClick={() => setShowManualForm(s => !s)}>
          {showManualForm ? '✕ ביטול' : '+ הוסיפי חתונה'}
        </button>
        {showManualForm && (
          <div className="sf-manual-form">
            <input className="sf-manual-input" placeholder="שם הזוג *" value={manualForm.name}
              onChange={e => setManualForm(p => ({ ...p, name: e.target.value }))} />
            <input className="sf-manual-input" type="number" placeholder="שכ&quot;ט (₪) *" value={manualForm.fee}
              onChange={e => setManualForm(p => ({ ...p, fee: e.target.value }))} style={{ width: 120 }} />
            <input className="sf-manual-input" type="number" placeholder="שולם (₪)" value={manualForm.paid}
              onChange={e => setManualForm(p => ({ ...p, paid: e.target.value }))} style={{ width: 120 }} />
            <input className="sf-manual-input" type="date" value={manualForm.event_date}
              onChange={e => setManualForm(p => ({ ...p, event_date: e.target.value }))} />
            <button className="sf-manual-add-btn" onClick={addManualWedding}>הוסף</button>
          </div>
        )}
        {manualWeddings.length === 0 && !showManualForm && (
          <p className="sf-empty">לא הוזנו חתונות ידנית עדיין</p>
        )}
        {manualWeddings.map(w => (
          <div key={w.id} className="sf-manual-row">
            <span className="sf-manual-row-name">{w.name}</span>
            <span className="sf-manual-row-nums">
              שכ"ט ₪{w.fee.toLocaleString('he-IL')} &nbsp;|&nbsp; שולם ₪{w.paid.toLocaleString('he-IL')}
              {w.event_date && ` | ${formatDate(w.event_date)}`}
            </span>
            <button className="sf-manual-remove" onClick={() => removeManualWedding(w.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
