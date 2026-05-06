import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Vendor } from '../types'
import '../styles/VendorWorksheet.css'

const SHIR_PHONE = '0508890134'
const SHIR_NAME = 'שיר מילוא'

const DEFAULT_VENDORS = [
  { category: 'הפקה (אני 😊)', pricing_type: 'fixed' },
  { category: 'קייטרינג', pricing_type: 'per_head' },
  { category: 'בר', pricing_type: 'per_head' },
  { category: 'עלות השטח', pricing_type: 'fixed' },
  { category: 'ציוד', pricing_type: 'fixed' },
  { category: 'שירותים', pricing_type: 'fixed' },
  { category: 'גנרטור', pricing_type: 'fixed' },
  { category: 'הגברה, חשמל ותאורה', pricing_type: 'fixed' },
  { category: 'עיצוב', pricing_type: 'fixed' },
  { category: 'די ג\'י', pricing_type: 'fixed' },
  { category: 'הסעות', pricing_type: 'fixed' },
  { category: 'צלם סטילס', pricing_type: 'fixed' },
  { category: 'איפור', pricing_type: 'fixed' },
  { category: 'עובדי הפקה', pricing_type: 'fixed' },
]

interface Payment {
  amount: string
  date: string
  method: 'מזומן' | "צ'ק" | 'העברה'
  includes_vat: boolean
}

interface VendorWorksheetProps {
  weddingId: string
  estimatedGuests: number
  vendors: Vendor[]
  onVendorsChange: (vendors: Vendor[]) => void
  readOnly: boolean
}

interface EditingVendor {
  id?: string
  vendor_name: string
  vendor_phone: string
  category: string
  pricing_type: 'fixed' | 'per_head'
  price_per_head: string
  contract_amount: string
  contract_includes_vat: boolean
  is_confirmed: boolean
  notes: string
  payments: Payment[]
  advance_amount: string
  advance_date: string
}

const emptyPayment = (): Payment => ({
  amount: '',
  date: '',
  method: 'העברה',
  includes_vat: false,
})

const emptyVendor = (): EditingVendor => ({
  vendor_name: '',
  vendor_phone: '',
  category: '',
  pricing_type: 'fixed',
  price_per_head: '',
  contract_amount: '',
  contract_includes_vat: true,
  is_confirmed: false,
  notes: '',
  payments: [],
  advance_amount: '',
  advance_date: '',
})

const VAT_RATE = 0.18

const vatAmount = (gross: number) => Math.round(gross * VAT_RATE / (1 + VAT_RATE))
const netAmount = (gross: number) => gross - vatAmount(gross)

export const VendorWorksheet: React.FC<VendorWorksheetProps> = ({
  weddingId, estimatedGuests, vendors, onVendorsChange, readOnly
}) => {
  const [guests, setGuests] = useState(estimatedGuests)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<EditingVendor>(emptyVendor())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null)
  const dragIdx = useRef<number | null>(null)
  const dragOverIdx = useRef<number | null>(null)

  const calcTotal = (v: Vendor) => {
    if (v.pricing_type === 'per_head' && v.price_per_head) return v.price_per_head * guests
    return v.contract_amount || 0
  }

  const getPayments = (v: Vendor): Payment[] => {
    try { return (v as any).payments ? JSON.parse((v as any).payments) : [] }
    catch { return [] }
  }

  const calcPaid = (v: Vendor) => {
    const pmts = getPayments(v)
    if (pmts.length > 0) return pmts.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    return v.amount_paid || 0
  }

  const grandTotal = vendors.reduce((s, v) => s + calcTotal(v), 0)
  const totalPaid = vendors.reduce((s, v) => s + calcPaid(v), 0)

  // The total contract for the form being edited
  const formContractTotal = () => {
    if (form.pricing_type === 'per_head') return (parseFloat(form.price_per_head) || 0) * guests
    return parseFloat(form.contract_amount) || 0
  }

  // Sum of all payments except the last one (which auto-fills)
  const formPaidExceptLast = () => {
    if (form.payments.length === 0) return 0
    return form.payments.slice(0, -1).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  }

  const formRemainder = () => {
    const advance = parseFloat(form.advance_amount) || 0
    const total = formContractTotal()
    const paidSoFar = formPaidExceptLast()
    return Math.max(0, total - advance - paidSoFar)
  }

  const startEdit = (v: Vendor) => {
    const pmts = getPayments(v)
    setForm({
      id: v.id,
      vendor_name: v.vendor_name,
      vendor_phone: (v as any).vendor_phone || '',
      category: v.category || '',
      pricing_type: v.pricing_type as 'fixed' | 'per_head',
      price_per_head: v.price_per_head?.toString() || '',
      contract_amount: v.contract_amount?.toString() || '',
      contract_includes_vat: (v as any).contract_includes_vat !== false,
      is_confirmed: v.is_confirmed || false,
      notes: v.notes || '',
      payments: pmts,
      advance_amount: (v as any).advance_amount?.toString() || '',
      advance_date: (v as any).advance_date || '',
    })
    setEditingId(v.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const totalFromPayments = form.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
      const payload = {
        wedding_id: weddingId,
        vendor_name: form.vendor_name || form.category,
        vendor_phone: form.vendor_phone || null,
        vendor_type: form.category,
        category: form.category,
        pricing_type: form.pricing_type,
        price_per_head: form.pricing_type === 'per_head' ? parseFloat(form.price_per_head) || 0 : null,
        contract_amount: form.pricing_type === 'fixed'
          ? parseFloat(form.contract_amount) || 0
          : (parseFloat(form.price_per_head) || 0) * guests,
        contract_includes_vat: form.contract_includes_vat,
        amount_paid: totalFromPayments,
        is_confirmed: form.is_confirmed,
        notes: form.notes,
        payments: JSON.stringify(form.payments),
        advance_amount: parseFloat(form.advance_amount) || null,
        advance_date: form.advance_date || null,
        sort_order: editingId ? undefined : vendors.length,
      }

      const tryWithoutVatCol = async (p: Record<string, any>) => {
        const { contract_includes_vat: _civ, ...without } = p
        return supabase.from('vendors').insert([without]).select()
      }

      if (editingId) {
        const { data, error } = await supabase.from('vendors').update(payload).eq('id', editingId).select()
        if (error) {
          if (error.message?.includes('contract_includes_vat')) {
            const { contract_includes_vat: _civ, ...without } = payload
            const { data: d2, error: e2 } = await supabase.from('vendors').update(without).eq('id', editingId).select()
            if (e2) throw e2
            if (d2) onVendorsChange(vendors.map(v => v.id === editingId ? d2[0] : v))
          } else throw error
        } else if (data) {
          onVendorsChange(vendors.map(v => v.id === editingId ? data[0] : v))
        }
      } else {
        const { data, error } = await supabase.from('vendors').insert([payload]).select()
        if (error) {
          if (error.message?.includes('contract_includes_vat') || error.code === '42703') {
            const { data: data2, error: error2 } = await tryWithoutVatCol(payload)
            if (error2) throw error2
            if (data2) onVendorsChange([...vendors, data2[0]])
          } else {
            throw error
          }
        } else if (data) {
          onVendorsChange([...vendors, data[0]])
        }
      }

      setForm(emptyVendor())
      setEditingId(null)
      setShowForm(false)
    } catch (err: any) {
      const msg = err?.message || err?.error_description || JSON.stringify(err)
      alert('שגיאה בשמירה: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('למחוק ספק זה?')) return
    await supabase.from('vendors').delete().eq('id', id)
    onVendorsChange(vendors.filter(v => v.id !== id))
  }

  const toggleConfirm = async (v: Vendor) => {
    const updated = { ...v, is_confirmed: !v.is_confirmed }
    await supabase.from('vendors').update({ is_confirmed: updated.is_confirmed }).eq('id', v.id)
    onVendorsChange(vendors.map(x => x.id === v.id ? updated : x))
  }

  const addDefaultVendor = (def: typeof DEFAULT_VENDORS[0]) => {
    const isShir = def.category === 'הפקה (אני 😊)'
    setForm({
      ...emptyVendor(),
      category: def.category,
      pricing_type: def.pricing_type as 'fixed' | 'per_head',
      vendor_name: isShir ? SHIR_NAME : '',
      vendor_phone: isShir ? SHIR_PHONE : '',
    })
    setEditingId(null)
    setShowForm(true)
  }

  const updatePayment = (idx: number, field: keyof Payment, value: any) => {
    setForm(p => {
      const pmts = [...p.payments]
      const updated = { ...pmts[idx], [field]: value }
      // Cash payments are never subject to VAT
      if (field === 'method' && value === 'מזומן') {
        updated.includes_vat = false
      }
      pmts[idx] = updated
      return { ...p, payments: pmts }
    })
  }

  const removePayment = (idx: number) => {
    setForm(p => ({ ...p, payments: p.payments.filter((_, i) => i !== idx) }))
  }

  // Drag & drop reorder
  const handleDragStart = (idx: number) => { dragIdx.current = idx }
  const handleDragEnter = (idx: number) => { dragOverIdx.current = idx }
  const handleDragEnd = async () => {
    const from = dragIdx.current
    const to = dragOverIdx.current
    if (from === null || to === null || from === to) { dragIdx.current = null; dragOverIdx.current = null; return }
    const reordered = [...vendors]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    onVendorsChange(reordered)
    dragIdx.current = null
    dragOverIdx.current = null
    // Persist sort order
    await Promise.all(reordered.map((v, i) => supabase.from('vendors').update({ sort_order: i }).eq('id', v.id)))
  }

  const existingCategories = vendors.map(v => v.category || v.vendor_type)
  const availableDefaults = DEFAULT_VENDORS.filter(d => !existingCategories.includes(d.category))

  const lastPaymentIdx = form.payments.length - 1

  return (
    <div className="vw-wrap">
      <div className="vw-guests-row">
        <label>כמות אורחים מוערך:</label>
        <input
          type="number"
          className="vw-guests-input"
          value={guests}
          onChange={e => setGuests(parseInt(e.target.value) || 0)}
          disabled={readOnly}
        />
        <span className="vw-guests-note">המחיר הכולל מחושב לפי מספר זה</span>
      </div>

      {!readOnly && (
        <div className="vw-actions-row">
          {availableDefaults.length > 0 && (
            <div className="vw-defaults">
              <span className="vw-defaults-label">הוסף ספק קבוע:</span>
              <div className="vw-defaults-btns">
                {availableDefaults.map(d => (
                  <button key={d.category} className="vw-default-btn" onClick={() => addDefaultVendor(d)}>
                    + {d.category}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="btn btn-primary btn-small" onClick={() => { setForm(emptyVendor()); setEditingId(null); setShowForm(true) }}>
            + ספק מותאם אישית
          </button>
        </div>
      )}

      {showForm && !readOnly && (
        <div className="vw-form">
          {/* Category + name */}
          <div className="vw-form-row">
            <div className="vw-form-group">
              <label>קטגוריה</label>
              <input className="vw-input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="קייטרינג, צלם..." />
            </div>
            <div className="vw-form-group">
              <label>שם הספק</label>
              <input className="vw-input" value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))} placeholder="שם הספק (אופציונלי)" />
            </div>
          </div>

          <div className="vw-form-group">
            <label>טלפון ספק</label>
            <input className="vw-input" type="tel" value={form.vendor_phone} onChange={e => setForm(p => ({...p, vendor_phone: e.target.value}))} placeholder="050-0000000" />
          </div>

          {/* Pricing type */}
          <div className="vw-form-group">
            <label>אופן תמחור</label>
            <div className="vw-type-btns">
              <button className={`vw-type-btn ${form.pricing_type === 'fixed' ? 'active' : ''}`} onClick={() => setForm(p => ({ ...p, pricing_type: 'fixed' }))}>מחיר קבוע</button>
              <button className={`vw-type-btn ${form.pricing_type === 'per_head' ? 'active' : ''}`} onClick={() => setForm(p => ({ ...p, pricing_type: 'per_head' }))}>מחיר לפי ראש</button>
            </div>
          </div>

          {form.pricing_type === 'per_head' ? (
            <div className="vw-form-row">
              <div className="vw-form-group">
                <label>מחיר לאורח (₪)</label>
                <input className="vw-input" type="number" value={form.price_per_head} onChange={e => setForm(p => ({ ...p, price_per_head: e.target.value }))} />
              </div>
              <div className="vw-form-group">
                <label>סה"כ מוערך ({guests} אורחים)</label>
                <input className="vw-input" readOnly value={`₪${((parseFloat(form.price_per_head) || 0) * guests).toLocaleString()}`} />
              </div>
            </div>
          ) : (
            <div className="vw-form-group">
              <label>מחיר כולל (₪)</label>
              <input className="vw-input" type="number" value={form.contract_amount} onChange={e => setForm(p => ({ ...p, contract_amount: e.target.value }))} />
            </div>
          )}

          {/* VAT type toggle */}
          <div className="vw-form-group">
            <label>מחיר החוזה</label>
            <div className="vw-type-btns">
              <button
                className={`vw-type-btn ${form.contract_includes_vat ? 'active' : ''}`}
                onClick={() => setForm(p => ({ ...p, contract_includes_vat: true }))}
              >כולל מע"מ</button>
              <button
                className={`vw-type-btn ${!form.contract_includes_vat ? 'active' : ''}`}
                onClick={() => setForm(p => ({ ...p, contract_includes_vat: false }))}
              >לא כולל מע"מ</button>
            </div>
            <span className="vw-vat-mode-hint">
              {form.contract_includes_vat
                ? 'המחיר כולל מע"מ — תשלומים במזומן פטורים, שאר התשלומים יופחת מהם מע"מ'
                : 'המחיר לא כולל מע"מ — מע"מ יתווסף על תשלומים שאינם מזומן'}
            </span>
          </div>

          {/* Advance */}
          <div className="vw-section-title">מקדמה</div>
          <div className="vw-form-row">
            <div className="vw-form-group">
              <label>סכום מקדמה (₪)</label>
              <input className="vw-input" type="number" value={form.advance_amount} onChange={e => setForm(p => ({ ...p, advance_amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="vw-form-group">
              <label>תאריך מקדמה</label>
              <input className="vw-input" type="date" value={form.advance_date} onChange={e => setForm(p => ({ ...p, advance_date: e.target.value }))} />
            </div>
          </div>

          {/* Payments */}
          <div className="vw-section-title">
            תשלומים
            <button className="vw-add-payment-btn" onClick={() => setForm(p => ({ ...p, payments: [...p.payments, emptyPayment()] }))}>+ הוסף תשלום</button>
          </div>

          {formContractTotal() > 0 && (
            <div className="vw-balance-bar">
              <span>סה"כ חוזה: <strong>₪{formContractTotal().toLocaleString()}</strong></span>
              {(parseFloat(form.advance_amount) || 0) > 0 && <span>מקדמה: <strong>₪{(parseFloat(form.advance_amount) || 0).toLocaleString()}</strong></span>}
              <span className="vw-balance-remaining">יתרה לחלוקה: <strong>₪{formRemainder().toLocaleString()}</strong></span>
            </div>
          )}

          {form.payments.map((pmt, idx) => {
            const isLast = idx === lastPaymentIdx
            const autoAmount = isLast && form.payments.length > 0 ? formRemainder() : null
            const displayAmount = isLast && pmt.amount === '' ? autoAmount : parseFloat(pmt.amount) || 0
            const gross = displayAmount || 0

            return (
              <div key={idx} className={`vw-payment-row ${isLast ? 'vw-payment-row-last' : ''}`}>
                <div className="vw-form-group vw-payment-amount">
                  <label>
                    סכום (₪)
                    {isLast && <span className="vw-auto-label"> — מתמלא אוטומטית</span>}
                  </label>
                  <input
                    className="vw-input"
                    type="number"
                    value={pmt.amount}
                    placeholder={isLast && autoAmount !== null ? `${autoAmount.toLocaleString()} (יתרה)` : '0'}
                    onChange={e => updatePayment(idx, 'amount', e.target.value)}
                  />
                </div>
                <div className="vw-form-group">
                  <label>תאריך</label>
                  <input className="vw-input" type="date" value={pmt.date} onChange={e => updatePayment(idx, 'date', e.target.value)} />
                </div>
                <div className="vw-form-group">
                  <label>אמצעי תשלום</label>
                  <select className="vw-input" value={pmt.method} onChange={e => updatePayment(idx, 'method', e.target.value as any)}>
                    <option value="העברה">העברה בנקאית</option>
                    <option value="מזומן">מזומן</option>
                    <option value="צ'ק">צ'ק</option>
                  </select>
                </div>
                <div className="vw-form-group vw-vat-group">
                  <label>מע"מ</label>
                  {pmt.method === 'מזומן' ? (
                    <span className="vw-vat-cash-badge">מזומן — ללא מע"מ</span>
                  ) : (
                    <button
                      className={`vw-vat-btn ${pmt.includes_vat ? 'active' : ''}`}
                      onClick={() => updatePayment(idx, 'includes_vat', !pmt.includes_vat)}
                    >
                      {pmt.includes_vat ? 'כולל מע"מ' : 'ללא מע"מ'}
                    </button>
                  )}
                  {pmt.includes_vat && gross > 0 && (
                    <span className="vw-vat-breakdown">
                      נטו ₪{netAmount(gross).toLocaleString()} + מע"מ ₪{vatAmount(gross).toLocaleString()}
                    </span>
                  )}
                </div>
                <button className="vw-remove-payment" onClick={() => removePayment(idx)}>✕</button>
              </div>
            )
          })}

          {form.payments.length > 0 && (() => {
            const cashTotal = form.payments
              .filter(p => p.method === 'מזומן')
              .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
            const nonCashTotal = form.payments
              .filter(p => p.method !== 'מזומן')
              .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)

            if (form.contract_includes_vat) {
              // Price includes VAT: cash is exempt, non-cash has VAT extracted from it
              const nonCashNet = Math.round(nonCashTotal / (1 + VAT_RATE))
              const nonCashVat = nonCashTotal - nonCashNet
              const totalPaid = cashTotal + nonCashTotal
              return (
                <div className="vw-vat-summary">
                  <div className="vw-vat-summary-row">
                    <span>סה"כ תשלומים (כולל מע"מ)</span>
                    <strong>₪{totalPaid.toLocaleString()}</strong>
                  </div>
                  {cashTotal > 0 && (
                    <div className="vw-vat-summary-row vw-vat-cash">
                      <span>מזומן — פטור ממע"מ</span>
                      <span>₪{cashTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {nonCashTotal > 0 && (
                    <div className="vw-vat-summary-row vw-vat-detail">
                      <span>העברה/צ'ק — נטו + מע"מ</span>
                      <span>₪{nonCashNet.toLocaleString()} + ₪{nonCashVat.toLocaleString()} מע"מ</span>
                    </div>
                  )}
                  {nonCashVat > 0 && (
                    <div className="vw-vat-summary-row vw-vat-total">
                      <span>סה"כ מע"מ לדיווח</span>
                      <strong>₪{nonCashVat.toLocaleString()}</strong>
                    </div>
                  )}
                </div>
              )
            } else {
              // Price excludes VAT: VAT added on top of non-cash payments that include_vat
              const vatBase = form.payments
                .filter(p => p.method !== 'מזומן' && p.includes_vat)
                .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
              const nonVatTransfer = form.payments
                .filter(p => p.method !== 'מזומן' && !p.includes_vat)
                .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
              const vatAmt = Math.round(vatBase * VAT_RATE)
              const totalWithVat = cashTotal + vatBase + vatAmt + nonVatTransfer
              return (
                <div className="vw-vat-summary">
                  <div className="vw-vat-summary-row">
                    <span>סה"כ לתשלום (כולל מע"מ)</span>
                    <strong>₪{totalWithVat.toLocaleString()}</strong>
                  </div>
                  {cashTotal > 0 && (
                    <div className="vw-vat-summary-row vw-vat-cash">
                      <span>מזומן — ללא מע"מ</span>
                      <span>₪{cashTotal.toLocaleString()}</span>
                    </div>
                  )}
                  {vatBase > 0 && (
                    <div className="vw-vat-summary-row vw-vat-detail">
                      <span>בסיס מע"מ + מע"מ 18%</span>
                      <span>₪{vatBase.toLocaleString()} + ₪{vatAmt.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )
            }
          })()}

          {/* Confirmed + notes */}
          <div className="vw-form-row" style={{ marginTop: 12 }}>
            <div className="vw-form-group vw-confirm-group">
              <label>מחיר סגור?</label>
              <button className={`vw-confirm-btn ${form.is_confirmed ? 'confirmed' : ''}`} onClick={() => setForm(p => ({ ...p, is_confirmed: !p.is_confirmed }))}>
                {form.is_confirmed ? '✓ סגור' : 'עדיין לא'}
              </button>
            </div>
            <div className="vw-form-group">
              <label>הערות</label>
              <input className="vw-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="הערות..." />
            </div>
          </div>

          <div className="vw-form-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'שומר...' : 'שמור'}</button>
            <button className="btn" style={{ background: '#eee', color: '#555' }} onClick={() => { setShowForm(false); setEditingId(null) }}>ביטול</button>
          </div>
        </div>
      )}

      {vendors.length > 0 && (
        <div className="vw-table-wrap">
          {!readOnly && <p className="vw-drag-hint">↕ גרירה לשינוי סדר</p>}
          <table className="vw-table">
            <thead>
              <tr>
                {!readOnly && <th className="vw-drag-col" />}
                <th>קטגוריה</th>
                <th>ספק</th>
                <th>מחיר לראש</th>
                <th>סה"כ מוערך</th>
                <th>שולם</th>
                <th>מחיר סגור</th>
                {!readOnly && <th>פעולות</th>}
              </tr>
            </thead>
            <tbody>
              {vendors.map((v, idx) => {
                const pmts = getPayments(v)
                const paid = calcPaid(v)
                const isExpanded = expandedVendor === v.id
                return (
                  <React.Fragment key={v.id}>
                    <tr
                      className={v.is_confirmed ? 'confirmed-row' : ''}
                      draggable={!readOnly}
                      onDragStart={() => handleDragStart(idx)}
                      onDragEnter={() => handleDragEnter(idx)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => e.preventDefault()}
                      style={{ cursor: readOnly ? 'default' : 'grab' }}
                    >
                      {!readOnly && <td className="vw-drag-handle">⠿</td>}
                      <td><strong>{v.category || v.vendor_type}</strong></td>
                      <td>
                        {v.vendor_name !== v.category ? v.vendor_name : '—'}
                        {(v as any).vendor_phone && (
                          <a
                            href={`https://wa.me/972${((v as any).vendor_phone as string).replace(/^0/, '').replace(/\D/g,'')}`}
                            target="_blank" rel="noreferrer"
                            className="vw-vendor-wa"
                            title={`שלח ל${v.vendor_name} בוואטסאפ`}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="#25D366" style={{verticalAlign:'middle'}}>
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        )}
                      </td>
                      <td>{v.pricing_type === 'per_head' ? `₪${v.price_per_head?.toLocaleString()}` : '—'}</td>
                      <td className="vw-total">₪{calcTotal(v).toLocaleString()}</td>
                      <td>
                        {paid > 0 ? (
                          <button className="vw-paid-expand" onClick={() => setExpandedVendor(isExpanded ? null : v.id)}>
                            ₪{paid.toLocaleString()} {pmts.length > 0 ? (isExpanded ? '▲' : '▼') : ''}
                          </button>
                        ) : '—'}
                      </td>
                      <td>
                        <button
                          className={`vw-status-badge ${v.is_confirmed ? 'confirmed' : 'pending'}`}
                          onClick={() => !readOnly && toggleConfirm(v)}
                          style={{ cursor: readOnly ? 'default' : 'pointer' }}
                        >
                          {v.is_confirmed ? '✓ סגור' : 'בהמתנה'}
                        </button>
                      </td>
                      {!readOnly && (
                        <td className="vw-actions">
                          <button className="vw-edit-btn" onClick={() => startEdit(v)}>עריכה</button>
                          <button className="vw-delete-btn" onClick={() => handleDelete(v.id)}>מחק</button>
                        </td>
                      )}
                    </tr>
                    {isExpanded && pmts.length > 0 && (
                      <tr className="vw-payments-expanded">
                        <td colSpan={readOnly ? 6 : 8}>
                          <div className="vw-payments-detail">
                            {(v as any).advance_amount > 0 && (
                              <div className="vw-payment-detail-row vw-advance-row">
                                <span className="vw-pd-label">מקדמה</span>
                                <span>₪{Number((v as any).advance_amount).toLocaleString()}</span>
                                {(v as any).advance_date && <span className="vw-pd-date">{(v as any).advance_date}</span>}
                              </div>
                            )}
                            {pmts.map((p, i) => {
                              const gross = parseFloat(p.amount) || 0
                              const includedVat = (v as any).contract_includes_vat !== false
                              const isCash = p.method === 'מזומן'
                              const netAmt = includedVat && !isCash ? Math.round(gross / (1 + VAT_RATE)) : netAmount(gross)
                              const vatAmt = includedVat && !isCash ? gross - netAmt : vatAmount(gross)
                              return (
                                <div key={i} className="vw-payment-detail-row">
                                  <span className="vw-pd-label">תשלום {i + 1}</span>
                                  <span>₪{gross.toLocaleString()}</span>
                                  {isCash ? (
                                    <span className="vw-vat-cash-badge" style={{ fontSize: 11, padding: '1px 6px' }}>מזומן — פטור ממע"מ</span>
                                  ) : includedVat ? (
                                    <span className="vw-pd-vat">נטו ₪{netAmt.toLocaleString()} + מע"מ ₪{vatAmt.toLocaleString()}</span>
                                  ) : p.includes_vat ? (
                                    <span className="vw-pd-vat">נטו ₪{netAmount(gross).toLocaleString()} + מע"מ ₪{vatAmount(gross).toLocaleString()}</span>
                                  ) : null}
                                  <span className="vw-pd-method">{p.method}</span>
                                  {p.date && <span className="vw-pd-date">{p.date}</span>}
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="vw-total-row">
                <td colSpan={readOnly ? 3 : 4}><strong>סה"כ</strong></td>
                <td><strong>₪{grandTotal.toLocaleString()}</strong></td>
                <td><strong>₪{totalPaid.toLocaleString()}</strong></td>
                <td colSpan={readOnly ? 1 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {vendors.length === 0 && (
        <p className="vw-empty">אין ספקים עדיין — הוסיפי ספקים מהכפתורים למעלה</p>
      )}
    </div>
  )
}
