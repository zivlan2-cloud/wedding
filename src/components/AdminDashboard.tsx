import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Couple } from '../types'
import { CoupleProfile } from './CoupleProfile'
import { ShirFinance } from './ShirFinance'
import { ShirTasks } from './ShirTasks'
import { ShirMeetings } from './ShirMeetings'
import { WeddingTimeline } from './WeddingTimeline'
import '../styles/AdminDashboard.css'

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

  return (
    <div className="admin-layout">
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
                ).map(couple => (
                  <div
                    key={couple.id}
                    className="admin-couple-card"
                    onClick={() => setSelected(couple)}
                    style={{ borderTopColor: STATUS_COLORS[activeTab] }}
                  >
                    <div className="admin-couple-card-name">
                      {couple.couple_name || `${couple.partner1_name} ו${couple.partner2_name}`}
                    </div>
                    {couple.event_date && couple.event_date !== '2099-01-01' && (
                      <div className="admin-couple-card-date">
                        📅 {new Date(couple.event_date).toLocaleDateString('he-IL')}
                      </div>
                    )}
                    {couple.phone && (
                      <div className="admin-couple-card-phone">📞 {couple.phone}</div>
                    )}
                    {couple.budget > 0 && (
                      <div className="admin-couple-card-budget">₪{couple.budget.toLocaleString()}</div>
                    )}
                    <div className="admin-couple-card-arrow">פתח פרופיל ›</div>
                  </div>
                ))}
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
