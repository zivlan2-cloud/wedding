import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Couple } from '../types'
import { CoupleProfile } from './CoupleProfile'
import { ShirFinance } from './ShirFinance'
import { ShirTasks } from './ShirTasks'
import { ShirMeetings } from './ShirMeetings'
import { WeddingTimeline } from './WeddingTimeline'
import '../styles/AdminDashboard.css'

// Returns upcoming anniversary milestones for a couple given their wedding date
function getAnniversaryInfo(eventDate: string): {
  weddingDateStr: string
  nextAnniversaryLabel: string
  daysUntilNext: number
  yearsCompleted: number
} | null {
  if (!eventDate || eventDate === '2099-01-01') return null
  const wedding = new Date(eventDate)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (wedding > today) return null // hasn't happened yet

  const weddingDateStr = wedding.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
  const yearsCompleted = today.getFullYear() - wedding.getFullYear()

  // Next anniversary date (this year or next)
  let next = new Date(today.getFullYear(), wedding.getMonth(), wedding.getDate())
  if (next < today) next = new Date(today.getFullYear() + 1, wedding.getMonth(), wedding.getDate())
  const daysUntilNext = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const nextYears = next.getFullYear() - wedding.getFullYear()
  const nextAnniversaryLabel = nextYears === 1 ? 'שנה ראשונה' : `שנה ${nextYears}`

  return { weddingDateStr, nextAnniversaryLabel, daysUntilNext, yearsCompleted }
}

// Build notification list for the banner
function buildNotifications(couples: Couple[]): string[] {
  const notes: string[] = []
  const today = new Date(); today.setHours(0, 0, 0, 0)

  for (const c of couples) {
    if (!c.event_date || c.event_date === '2099-01-01') continue
    const wedding = new Date(c.event_date)
    const name = c.couple_name || `${c.partner1_name} ו${c.partner2_name}`

    // Day before wedding
    const daysToWedding = Math.ceil((wedding.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysToWedding === 1) notes.push(`🎊 מחר החתונה של ${name}! בהצלחה!`)
    if (daysToWedding === 0) notes.push(`💍 היום החתונה של ${name}! מזל טוב!`)

    // Anniversary milestones (for past weddings)
    if (wedding < today) {
      const thisYearAnniv = new Date(today.getFullYear(), wedding.getMonth(), wedding.getDate())
      const daysToAnniv = Math.ceil((thisYearAnniv.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const years = today.getFullYear() - wedding.getFullYear() + (daysToAnniv >= 0 ? 0 : -1) + 1
      if (daysToAnniv === 7) notes.push(`📸 עוד שבוע שנה ${years} לחתונת ${name} — זמן לפוסט אינסטגרם! ✨`)
      if (daysToAnniv === 1) notes.push(`📸 מחר שנה ${years} לחתונת ${name} — זמן לפוסט אינסטגרם! 🎉`)
      if (daysToAnniv === 0) notes.push(`🎂 היום שנה ${years} לחתונת ${name}! מזל טוב! 💜`)
    }
  }
  return notes
}

type Status = 'מתלבטים' | 'פעילים' | 'עבר'
type MainSection = 'couples' | 'management'
type ManagementTab = 'finance' | 'tasks' | 'meetings'

const STATUS_COLORS: Record<Status, string> = {
  'מתלבטים': '#f8961e',
  'פעילים': '#6c63ff',
  'עבר': '#90be6d',
}

const SLIDES = [
  '/images/1.jpeg',
  '/images/2.jpeg',
  '/images/3.jpeg',
  '/images/4.jpeg',
  '/images/5.jpeg',
  '/images/6.jpeg',
  '/images/7.jpeg',
  '/images/8.jpeg',
]

interface AdminDashboardProps {
  onLogout: () => void
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [couples, setCouples] = useState<Couple[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Couple | null>(null)
  const [activeTab, setActiveTab] = useState<Status>('מתלבטים')
  const [slideIndex, setSlideIndex] = useState(0)
  const [mainSection, setMainSection] = useState<MainSection>('couples')
  const [managementTab, setManagementTab] = useState<ManagementTab>('finance')
  const [search, setSearch] = useState('')
  const [bannerIndex, setBannerIndex] = useState(0)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [showAddCouple, setShowAddCouple] = useState(false)
  const [addForm, setAddForm] = useState({ partner1_name: '', partner2_name: '', phone: '', event_date: '', budget: '', status: 'עבר' as Status })
  const [addSaving, setAddSaving] = useState(false)

  useEffect(() => { fetchCouples() }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIndex(i => (i + 1) % SLIDES.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  const fetchCouples = async () => {
    const { data } = await supabase.from('couples').select('*').order('created_at', { ascending: false })
    setCouples(data || [])
    setLoading(false)
  }

  const updateStatus = async (couple: Couple, status: Status) => {
    await supabase.from('couples').update({ status }).eq('id', couple.id)
    setCouples(prev => prev.map(c => c.id === couple.id ? { ...c, status } : c))
    if (selected?.id === couple.id) setSelected({ ...couple, status })
  }

  const grouped = {
    'מתלבטים': couples.filter(c => (c.status || 'מתלבטים') === 'מתלבטים'),
    'פעילים': couples.filter(c => c.status === 'פעילים'),
    'עבר': couples.filter(c => c.status === 'עבר'),
  }

  const totalBudget = couples.filter(c => c.status === 'פעילים').reduce((s, c) => s + (c.budget || 0), 0)

  const handleSectionSwitch = (section: MainSection) => {
    setMainSection(section)
    if (section === 'couples') {
      // keep existing state
    } else {
      setSelected(null)
    }
  }

  const handleAddCouple = async () => {
    if (!addForm.partner1_name.trim() || !addForm.partner2_name.trim()) return
    setAddSaving(true)
    const token = Math.random().toString(36).substring(2, 12)
    const { data, error } = await supabase.from('couples').insert([{
      partner1_name: addForm.partner1_name.trim(),
      partner2_name: addForm.partner2_name.trim(),
      couple_name: `${addForm.partner1_name.trim()} ו${addForm.partner2_name.trim()}`,
      phone: addForm.phone.trim(),
      event_date: addForm.event_date || '2099-01-01',
      budget: parseFloat(addForm.budget) || 0,
      status: addForm.status,
      couple_link_token: token,
      guest_count: 0,
      estimated_guests: 0,
      wedding_style: '',
    }]).select().single()
    if (error) {
      alert('שגיאה: ' + error.message)
      setAddSaving(false)
      return
    }
    if (data) {
      setCouples(prev => [data, ...prev])
      setActiveTab(addForm.status)
      setSelected(data)
    }
    setAddSaving(false)
    setShowAddCouple(false)
    setAddForm({ partner1_name: '', partner2_name: '', phone: '', event_date: '', budget: '', status: 'עבר' })
  }

  const notifications = buildNotifications(couples)

  return (
    <div className="admin-layout">
      {/* ── Slide-down notification banner ── */}
      {notifications.length > 0 && !bannerDismissed && (
        <div className="admin-banner">
          <div className="admin-banner-content">
            <span className="admin-banner-text">{notifications[bannerIndex]}</span>
            {notifications.length > 1 && (
              <div className="admin-banner-nav">
                <button onClick={() => setBannerIndex(i => (i - 1 + notifications.length) % notifications.length)}>‹</button>
                <span>{bannerIndex + 1}/{notifications.length}</span>
                <button onClick={() => setBannerIndex(i => (i + 1) % notifications.length)}>›</button>
              </div>
            )}
          </div>
          <button className="admin-banner-close" onClick={() => setBannerDismissed(true)}>✕</button>
        </div>
      )}

      {/* Background slideshow */}
      <div className="admin-bg-slides">
        {SLIDES.map((src, i) => (
          <div
            key={i}
            className={`admin-bg-slide ${i === slideIndex ? 'active' : ''}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
        <div className="admin-bg-overlay" />
      </div>

      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-text">שיר ✦ מפיקה</span>
        </div>

        {/* Main section toggle */}
        <div className="admin-section-toggle">
          <button
            className={`admin-section-btn ${mainSection === 'couples' ? 'active' : ''}`}
            onClick={() => handleSectionSwitch('couples')}
          >
            <span>👫</span>
            <span>הזוגות שלי</span>
          </button>
          <button
            className={`admin-section-btn admin-section-btn-management ${mainSection === 'management' ? 'active' : ''}`}
            onClick={() => handleSectionSwitch('management')}
          >
            <span>📊</span>
            <span>הניהול שלי</span>
          </button>
        </div>

        {/* Couples section content */}
        {mainSection === 'couples' && (
          <>
            <div className="admin-kpis">
              <div className="admin-kpi">
                <span>{grouped['מתלבטים'].length}</span>
                <label>מתלבטים</label>
              </div>
              <div className="admin-kpi">
                <span>{grouped['פעילים'].length}</span>
                <label>פעילים</label>
              </div>
              <div className="admin-kpi">
                <span>₪{(totalBudget / 1000).toFixed(0)}k</span>
                <label>תקציב פעיל</label>
              </div>
            </div>

            <div className="admin-tabs">
              {(['מתלבטים', 'פעילים', 'עבר'] as Status[]).map(tab => (
                <button
                  key={tab}
                  className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
                  style={activeTab === tab ? { borderColor: STATUS_COLORS[tab], color: STATUS_COLORS[tab] } : {}}
                  onClick={() => { setActiveTab(tab); setSelected(null) }}
                >
                  <span className="tab-dot" style={{ background: STATUS_COLORS[tab] }} />
                  {tab}
                  <span className="tab-count">{grouped[tab].length}</span>
                </button>
              ))}
            </div>

            <button className="admin-add-couple-btn" onClick={() => setShowAddCouple(true)}>
              + הוסף זוג
            </button>

            <input
              className="admin-search"
              placeholder="חיפוש זוג..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <div className="admin-couples-list">
              {loading ? <p className="admin-loading">טוען...</p> : null}
              {grouped[activeTab].filter(c =>
                (c.couple_name || `${c.partner1_name} ו${c.partner2_name}`).toLowerCase().includes(search.toLowerCase())
              ).length === 0 && !loading && (
                <p className="admin-empty">אין זוגות בקטגוריה זו</p>
              )}
              {grouped[activeTab].filter(c =>
                (c.couple_name || `${c.partner1_name} ו${c.partner2_name}`).toLowerCase().includes(search.toLowerCase())
              ).map(couple => (
                <div
                  key={couple.id}
                  className={`admin-couple-item ${selected?.id === couple.id ? 'active' : ''}`}
                  onClick={() => setSelected(couple)}
                >
                  <strong>{couple.couple_name || `${couple.partner1_name} ו${couple.partner2_name}`}</strong>
                  {couple.event_date && couple.event_date !== '2099-01-01' && (
                    <span>📅 {new Date(couple.event_date).toLocaleDateString('he-IL')}</span>
                  )}
                  <span>{couple.phone || ''}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Management section content in sidebar */}
        {mainSection === 'management' && (
          <div className="admin-management-tabs">
            <button
              className={`admin-mgmt-tab ${managementTab === 'finance' ? 'active' : ''}`}
              onClick={() => setManagementTab('finance')}
            >
              <span>💰</span>
              <span>פיננסים</span>
            </button>
            <button
              className={`admin-mgmt-tab ${managementTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setManagementTab('tasks')}
            >
              <span>✅</span>
              <span>משימות</span>
            </button>
            <button
              className={`admin-mgmt-tab ${managementTab === 'meetings' ? 'active' : ''}`}
              onClick={() => setManagementTab('meetings')}
            >
              <span>📅</span>
              <span>פגישות</span>
            </button>
          </div>
        )}

        <button className="admin-logout" onClick={onLogout}>התנתק</button>
      </aside>

      {/* ── Add Couple Modal ── */}
      {showAddCouple && (
        <div className="admin-modal-overlay" onClick={() => setShowAddCouple(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>הוסף זוג חדש</h2>
              <button className="admin-modal-close" onClick={() => setShowAddCouple(false)}>✕</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-modal-row">
                <div className="admin-modal-group">
                  <label>שם בן/בת זוג א׳ *</label>
                  <input className="admin-modal-input" placeholder="למשל: נועה" value={addForm.partner1_name} onChange={e => setAddForm(p => ({ ...p, partner1_name: e.target.value }))} />
                </div>
                <div className="admin-modal-group">
                  <label>שם בן/בת זוג ב׳ *</label>
                  <input className="admin-modal-input" placeholder="למשל: דניאל" value={addForm.partner2_name} onChange={e => setAddForm(p => ({ ...p, partner2_name: e.target.value }))} />
                </div>
              </div>
              <div className="admin-modal-row">
                <div className="admin-modal-group">
                  <label>טלפון</label>
                  <input className="admin-modal-input" placeholder="050-0000000" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="admin-modal-group">
                  <label>תאריך החתונה</label>
                  <input className="admin-modal-input" type="date" value={addForm.event_date} onChange={e => setAddForm(p => ({ ...p, event_date: e.target.value }))} />
                </div>
              </div>
              <div className="admin-modal-row">
                <div className="admin-modal-group">
                  <label>תקציב (₪)</label>
                  <input className="admin-modal-input" type="number" placeholder="0" value={addForm.budget} onChange={e => setAddForm(p => ({ ...p, budget: e.target.value }))} />
                </div>
                <div className="admin-modal-group">
                  <label>סטטוס</label>
                  <select className="admin-modal-input" value={addForm.status} onChange={e => setAddForm(p => ({ ...p, status: e.target.value as Status }))}>
                    <option value="עבר">עבר</option>
                    <option value="פעילים">פעילים</option>
                    <option value="מתלבטים">מתלבטים</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-modal-save" onClick={handleAddCouple} disabled={addSaving || !addForm.partner1_name.trim() || !addForm.partner2_name.trim()}>
                {addSaving ? 'שומר...' : '+ הוסף זוג'}
              </button>
              <button className="admin-modal-cancel" onClick={() => setShowAddCouple(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      <main className="admin-main">
        {mainSection === 'couples' ? (
          selected ? (
            <CoupleProfile
              couple={selected}
              onStatusChange={(status) => updateStatus(selected, status as Status)}
              onUpdate={(updated) => {
                setCouples(prev => prev.map(c => c.id === updated.id ? updated : c))
                setSelected(updated)
              }}
              onDelete={() => {
                setCouples(prev => prev.filter(c => c.id !== selected.id))
                setSelected(null)
              }}
            />
          ) : (
            <div className="admin-couples-grid-view">
              <div className="admin-grid-header">
                <div className="admin-grid-title" style={{ borderColor: STATUS_COLORS[activeTab], color: STATUS_COLORS[activeTab] }}>
                  <span className="admin-grid-dot" style={{ background: STATUS_COLORS[activeTab] }} />
                  {activeTab}
                  <span className="admin-grid-count">{grouped[activeTab].length}</span>
                </div>
              </div>
              {grouped[activeTab].filter(c =>
                (c.couple_name || `${c.partner1_name} ו${c.partner2_name}`).toLowerCase().includes(search.toLowerCase())
              ).length === 0 && !loading && (
                <div className="admin-grid-empty">אין זוגות בקטגוריה זו</div>
              )}
              <div className="admin-couples-grid">
                {grouped[activeTab].filter(c =>
                  (c.couple_name || `${c.partner1_name} ו${c.partner2_name}`).toLowerCase().includes(search.toLowerCase())
                ).map(couple => {
                  const anniv = activeTab === 'עבר' ? getAnniversaryInfo(couple.event_date) : null
                  const d = couple.event_date && couple.event_date !== '2099-01-01' ? new Date(couple.event_date) : null
                  const today = new Date(); today.setHours(0,0,0,0)
                  const daysToWedding = d ? Math.ceil((d.getTime() - today.getTime()) / (1000*60*60*24)) : null
                  return (
                    <div
                      key={couple.id}
                      className="admin-couple-card"
                      onClick={() => setSelected(couple)}
                      style={{ borderTopColor: STATUS_COLORS[activeTab] }}
                    >
                      <div className="admin-couple-card-name">
                        {couple.couple_name || `${couple.partner1_name} ו${couple.partner2_name}`}
                      </div>

                      {/* Future wedding date */}
                      {d && daysToWedding !== null && daysToWedding > 0 && (
                        <div className="admin-couple-card-date-wrap">
                          <span className="admin-couple-card-date">📅 {d.toLocaleDateString('he-IL')}</span>
                          <span className="admin-couple-card-days" style={{ background: daysToWedding <= 30 ? '#e63946' : daysToWedding <= 90 ? '#f8961e' : '#6c63ff' }}>
                            {`${daysToWedding}י׳`}
                          </span>
                        </div>
                      )}

                      {/* Past wedding — anniversary info */}
                      {anniv && (
                        <div className="admin-couple-card-anniv">
                          <div className="admin-couple-card-anniv-date">
                            💒 {anniv.weddingDateStr}
                            <span className="admin-couple-card-anniv-years">({anniv.yearsCompleted} שנים)</span>
                          </div>
                          <div className={`admin-couple-card-anniv-next ${anniv.daysUntilNext <= 7 ? 'soon' : ''}`}>
                            📸 {anniv.nextAnniversaryLabel} — עוד {anniv.daysUntilNext} ימים
                          </div>
                        </div>
                      )}

                      {!d && <div className="admin-couple-card-no-date">📅 תאריך לא נקבע</div>}
                      {couple.phone && <div className="admin-couple-card-phone">📞 {couple.phone}</div>}
                      {couple.budget > 0 && <div className="admin-couple-card-budget">₪{couple.budget.toLocaleString()}</div>}
                      <div className="admin-couple-card-arrow">פתח פרופיל ›</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        ) : (
          <div className="admin-management-view">
            <WeddingTimeline couples={couples} />
            {managementTab === 'finance' && (
              <ShirFinance couples={couples} />
            )}
            {managementTab === 'tasks' && (
              <ShirTasks couples={couples} />
            )}
            {managementTab === 'meetings' && (
              <ShirMeetings couples={couples} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
