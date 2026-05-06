import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Couple, Vendor } from '../types'
import { VendorWorksheet } from './VendorWorksheet'
import { CoupleSignature } from './CoupleSignature'
import { SeatingManager } from './SeatingManager'
import '../styles/CoupleWorkPage.css'

type CoupleTab = 'vendors' | 'seating' | 'documents'

interface DocRecord {
  id: string
  file_name: string
  file_url: string
  doc_zone?: string
}

export const CoupleWorkPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [couple, setCouple] = useState<Couple | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [documents, setDocuments] = useState<DocRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<CoupleTab>('vendors')
  const [editingDetails, setEditingDetails] = useState(false)
  const [editForm, setEditForm] = useState({ budget: '', estimated_guests: '', venue_name: '', venue_cost: '', event_date: '' })
  const [savingDetails, setSavingDetails] = useState(false)

  useEffect(() => { fetchData() }, [token])

  const fetchData = async () => {
    const { data: coupleData } = await supabase
      .from('couples').select('*').eq('couple_link_token', token).single()

    if (!coupleData) { setNotFound(true); setLoading(false); return }

    setCouple(coupleData)
    setEditForm({
      budget: coupleData.budget?.toString() || '',
      estimated_guests: coupleData.estimated_guests?.toString() || coupleData.guest_count?.toString() || '',
      venue_name: coupleData.venue_name || '',
      venue_cost: coupleData.venue_cost?.toString() || '',
      event_date: (coupleData.event_date && coupleData.event_date !== '2099-01-01') ? coupleData.event_date : '',
    })

    const { data: vendorData } = await supabase.from('vendors').select('*').eq('wedding_id', coupleData.id).order('sort_order').order('created_at')
    setVendors(vendorData || [])

    const { data: docData } = await supabase.from('documents').select('*').eq('wedding_id', coupleData.id).order('created_at', { ascending: false })
    setDocuments(docData || [])
    setLoading(false)
  }

  const handleSaveDetails = async () => {
    if (!couple) return
    setSavingDetails(true)
    const updates = {
      budget: parseFloat(editForm.budget) || 0,
      estimated_guests: parseInt(editForm.estimated_guests) || 0,
      guest_count: parseInt(editForm.estimated_guests) || 0,
      venue_name: editForm.venue_name || null,
      venue_cost: editForm.venue_cost ? parseFloat(editForm.venue_cost) : null,
      has_venue: !!editForm.venue_name,
      event_date: editForm.event_date || '2099-01-01',
    }
    await supabase.from('couples').update(updates).eq('id', couple.id)
    setCouple(prev => prev ? { ...prev, ...updates } : prev)
    setSavingDetails(false)
    setEditingDetails(false)
  }

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, zone: string) => {
    const file = e.target.files?.[0]
    if (!file || !couple) return
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
        uploaded_by: 'couple',
        doc_zone: zone,
      }])
      fetchData()
    } catch (err) {
      alert('שגיאה בהעלאה: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUploadingDoc(null)
      e.target.value = ''
    }
  }

  const quotes = documents.filter(d => d.doc_zone === 'quotes' || !d.doc_zone)
  const contracts = documents.filter(d => d.doc_zone === 'contracts')
  const pendingContracts = documents.filter(d => d.doc_zone === 'pending_signature')

  const guests = couple?.estimated_guests || couple?.guest_count || 0
  const totalContract = vendors.reduce((s, v) => {
    if (v.pricing_type === 'per_head' && v.price_per_head) return s + v.price_per_head * guests
    return s + (v.contract_amount || 0)
  }, 0)

  if (loading) return <div className="cwp-loading"><p>טוענים את הדף שלכם...</p></div>
  if (notFound) return (
    <div className="cwp-notfound">
      <h2>הדף לא נמצא</h2>
      <p>אנא פנה לשיר לקבלת הקישור הנכון</p>
    </div>
  )
  if (!couple) return null

  return (
    <div className="cwp-page">
      <div className="cwp-bg" />

      {/* Decorative botanical SVGs */}
      <svg className="cwp-leaf-left" width="160" height="560" viewBox="0 0 160 560" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Main stem */}
        <path d="M130 20 C100 100, 70 220, 80 360 C88 440, 110 500, 120 550" stroke="#7D5C3C" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        {/* Branches */}
        <path d="M120 80 C90 70, 55 80, 35 110" stroke="#7D5C3C" strokeWidth="1" fill="none" strokeLinecap="round"/>
        <path d="M105 160 C75 145, 42 155, 22 185" stroke="#A07850" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
        <path d="M95 250 C68 238, 38 248, 20 275" stroke="#7D5C3C" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
        <path d="M88 340 C62 330, 34 342, 18 368" stroke="#A07850" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
        {/* Leaves */}
        <ellipse cx="52" cy="95" rx="22" ry="10" fill="#7D5C3C" opacity="0.18" transform="rotate(-25 52 95)"/>
        <ellipse cx="36" cy="170" rx="20" ry="9" fill="#E8C4B8" opacity="0.35" transform="rotate(-18 36 170)"/>
        <ellipse cx="30" cy="260" rx="18" ry="8" fill="#7D5C3C" opacity="0.15" transform="rotate(-12 30 260)"/>
        <ellipse cx="24" cy="352" rx="17" ry="8" fill="#E8D5C0" opacity="0.40" transform="rotate(-8 24 352)"/>
        {/* Small buds */}
        <circle cx="118" cy="78" r="4" fill="#E8C4B8" opacity="0.5"/>
        <circle cx="103" cy="158" r="3" fill="#7D5C3C" opacity="0.25"/>
        <circle cx="93" cy="248" r="3" fill="#E8C4B8" opacity="0.45"/>
      </svg>
      <svg className="cwp-leaf-right" width="160" height="560" viewBox="0 0 160 560" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M130 20 C100 100, 70 220, 80 360 C88 440, 110 500, 120 550" stroke="#7D5C3C" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        <path d="M120 80 C90 70, 55 80, 35 110" stroke="#7D5C3C" strokeWidth="1" fill="none" strokeLinecap="round"/>
        <path d="M105 160 C75 145, 42 155, 22 185" stroke="#A07850" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
        <path d="M95 250 C68 238, 38 248, 20 275" stroke="#7D5C3C" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
        <path d="M88 340 C62 330, 34 342, 18 368" stroke="#A07850" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
        <ellipse cx="52" cy="95" rx="22" ry="10" fill="#7D5C3C" opacity="0.18" transform="rotate(-25 52 95)"/>
        <ellipse cx="36" cy="170" rx="20" ry="9" fill="#E8C4B8" opacity="0.35" transform="rotate(-18 36 170)"/>
        <ellipse cx="30" cy="260" rx="18" ry="8" fill="#7D5C3C" opacity="0.15" transform="rotate(-12 30 260)"/>
        <ellipse cx="24" cy="352" rx="17" ry="8" fill="#E8D5C0" opacity="0.40" transform="rotate(-8 24 352)"/>
        <circle cx="118" cy="78" r="4" fill="#E8C4B8" opacity="0.5"/>
        <circle cx="103" cy="158" r="3" fill="#7D5C3C" opacity="0.25"/>
        <circle cx="93" cy="248" r="3" fill="#E8C4B8" opacity="0.45"/>
      </svg>

      <div className="cwp-container">

        <div className="cwp-header">
          <div className="cwp-brand">✦ שיר · מפיקת חתונות</div>
          <h1>שלום {couple.partner1_name} ו{couple.partner2_name}</h1>
          <p>זה דף העבודה האישי שלכם — כאן תוכלו לעקוב אחרי כל הספקים, המחירים ומצב התקציב.</p>
          <div className="cwp-header-divider"><span>✦</span></div>
        </div>

        {/* Summary */}
        <div className="cwp-summary">
          <div className="cwp-sum-item">
            <label>כמות אורחים מוערך</label>
            <span>{guests}</span>
          </div>
          <div className="cwp-sum-item">
            <label>תקציב מתוכנן</label>
            <span>₪{(couple.budget || 0).toLocaleString()}</span>
          </div>
          <div className="cwp-sum-item">
            <label>עלות מוערכת כוללת</label>
            <span className={totalContract > (couple.budget || 0) ? 'over' : ''}>
              ₪{totalContract.toLocaleString()}
            </span>
          </div>
          {couple.budget > 0 && (
            <div className="cwp-sum-item">
              <label>פער מתקציב</label>
              <span className={totalContract > couple.budget ? 'over' : 'under'}>
                {totalContract > couple.budget ? '+' : ''}₪{(totalContract - couple.budget).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Event details */}
        <div className="cwp-card">
          <div className="cwp-card-header">
            <h2>פרטי האירוע</h2>
            <button className="cwp-edit-btn" onClick={() => setEditingDetails(!editingDetails)}>
              {editingDetails ? 'ביטול' : '✏️ עריכה'}
            </button>
          </div>

          {editingDetails ? (
            <div className="cwp-edit-form">
              <div className="cwp-edit-row">
                <div className="cwp-edit-group">
                  <label>תקציב (₪)</label>
                  <input className="cwp-input" type="number" value={editForm.budget} onChange={e => setEditForm(p => ({ ...p, budget: e.target.value }))} />
                </div>
                <div className="cwp-edit-group">
                  <label>כמות אורחים מוערך</label>
                  <input className="cwp-input" type="number" value={editForm.estimated_guests} onChange={e => setEditForm(p => ({ ...p, estimated_guests: e.target.value }))} />
                </div>
              </div>
              <div className="cwp-edit-row">
                <div className="cwp-edit-group">
                  <label>תאריך החתונה 📅</label>
                  <input className="cwp-input cwp-input-date" type="date" value={editForm.event_date} onChange={e => setEditForm(p => ({ ...p, event_date: e.target.value }))} />
                </div>
              </div>
              <div className="cwp-edit-row">
                <div className="cwp-edit-group">
                  <label>מקום האירוע</label>
                  <input className="cwp-input" placeholder="שם המקום" value={editForm.venue_name} onChange={e => setEditForm(p => ({ ...p, venue_name: e.target.value }))} />
                </div>
                <div className="cwp-edit-group">
                  <label>עלות המקום (₪)</label>
                  <input className="cwp-input" type="number" value={editForm.venue_cost} onChange={e => setEditForm(p => ({ ...p, venue_cost: e.target.value }))} />
                </div>
              </div>
              <button className="cwp-save-btn" onClick={handleSaveDetails} disabled={savingDetails}>
                {savingDetails ? 'שומר...' : 'שמור פרטים'}
              </button>
            </div>
          ) : (
            <div className="cwp-details-view">
              {couple.event_date && couple.event_date !== '2099-01-01' ? (
                <div className="cwp-date-highlight">
                  <span className="cwp-date-label">📅 תאריך החתונה</span>
                  <span className="cwp-date-value">{new Date(couple.event_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {(() => {
                    const days = Math.ceil((new Date(couple.event_date).getTime() - new Date().setHours(0,0,0,0)) / (1000*60*60*24))
                    return <span className="cwp-date-countdown" style={{ background: days <= 30 ? '#e63946' : days <= 90 ? '#f8961e' : '#6c63ff' }}>
                      {days <= 0 ? '🎉 היום!' : days === 1 ? 'מחר!' : `עוד ${days} ימים`}
                    </span>
                  })()}
                </div>
              ) : (
                <p className="cwp-no-date">📅 תאריך טרם נקבע — לחצו על עריכה כדי להוסיף</p>
              )}
              {couple.venue_name && <p>📍 <strong>מקום:</strong> {couple.venue_name} {couple.venue_cost ? `— ₪${Number(couple.venue_cost).toLocaleString()}` : ''}</p>}
              <p>👥 <strong>כמות אורחים מוערך:</strong> {guests}</p>
              <p>💰 <strong>תקציב:</strong> ₪{(couple.budget || 0).toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="cwp-tabs">
          <button className={`cwp-tab-btn ${activeTab === 'vendors' ? 'active' : ''}`} onClick={() => setActiveTab('vendors')}>💼 ספקים</button>
          <button className={`cwp-tab-btn ${activeTab === 'seating' ? 'active' : ''}`} onClick={() => setActiveTab('seating')}>🪑 סידורי הושבה</button>
          <button className={`cwp-tab-btn ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>📄 חוזים</button>
        </div>

        {/* Vendors tab */}
        {activeTab === 'vendors' && (
          <div className="cwp-card">
            <h2>ספקים ומחירים</h2>
            <VendorWorksheet
              weddingId={couple.id}
              estimatedGuests={guests}
              vendors={vendors}
              onVendorsChange={setVendors}
              readOnly={false}
            />
          </div>
        )}

        {/* Seating tab */}
        {activeTab === 'seating' && (
          <div className="cwp-card">
            <h2>סידורי הושבה 🪑</h2>
            <SeatingManager weddingId={couple.id} readOnly={false} />
          </div>
        )}

        {/* Documents tab */}
        {activeTab === 'documents' && (
          <>
            {/* Pending contract signature */}
            {pendingContracts.length > 0 && (
              <div className="cwp-card">
                {pendingContracts.map(doc => (
                  <CoupleSignature
                    key={doc.id}
                    weddingId={couple.id}
                    partnerName={`${couple.partner1_name} ו${couple.partner2_name}`}
                    contractDoc={doc}
                    onSigned={fetchData}
                  />
                ))}
              </div>
            )}

            <div className="cwp-card">
              <h2>מסמכים 📁</h2>

              <div className="cwp-doc-zone">
                <h3>הצעות מחיר</h3>
                <p className="cwp-doc-zone-note">אל תחסכו — רכזו כאן את כל הצעות המחיר שקיבלתם מהספקים.</p>
                <label className="cwp-upload-btn">
                  {uploadingDoc === 'quotes' ? 'מעלה...' : '+ העלה הצעת מחיר'}
                  <input type="file" hidden onChange={e => handleDocUpload(e, 'quotes')} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                </label>
                {quotes.length === 0 && <p className="cwp-no-docs">אין הצעות מחיר עדיין</p>}
                <div className="cwp-docs-list">
                  {quotes.map(doc => (
                    <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer" className="cwp-doc-item">
                      📄 {doc.file_name}
                    </a>
                  ))}
                </div>
              </div>

              <div className="cwp-doc-zone">
                <h3>חוזים חתומים</h3>
                <p className="cwp-doc-zone-note">העלו כאן חוזים שכבר חתמתם — שיר תראה אותם גם היא.</p>
                <label className="cwp-upload-btn">
                  {uploadingDoc === 'contracts' ? 'מעלה...' : '+ העלה חוזה'}
                  <input type="file" hidden onChange={e => handleDocUpload(e, 'contracts')} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                </label>
                {contracts.length === 0 && <p className="cwp-no-docs">אין חוזים עדיין</p>}
                <div className="cwp-docs-list">
                  {contracts.map(doc => (
                    <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer" className="cwp-doc-item">
                      📄 {doc.file_name}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="cwp-footer">
          <p>שאלות? תמיד אפשר לכתוב לשיר ישירות 💜</p>
          <a href="https://wa.me/972508890134" className="cwp-wa-link" target="_blank" rel="noreferrer">💬 וואטסאפ</a>
        </div>
      </div>
    </div>
  )
}
