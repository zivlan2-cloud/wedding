import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Couple } from '../types'
import '../styles/ShirMeetings.css'

interface ShirMeetingsProps {
  couples: Couple[]
}

interface GCalEvent {
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  location?: string
  colorId?: string
  htmlLink: string
}

interface NewEventForm {
  title: string
  date: string
  startTime: string
  endTime: string
  location: string
  description: string
  coupleId: string
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPES = 'https://www.googleapis.com/auth/calendar'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'

// days of week in Hebrew
const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

function formatEventTime(event: GCalEvent): string {
  const raw = event.start.dateTime || event.start.date
  if (!raw) return ''
  const d = new Date(raw)
  if (event.start.date && !event.start.dateTime) {
    return 'כל היום'
  }
  const end = event.end.dateTime ? new Date(event.end.dateTime) : null
  const startStr = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  const endStr = end ? end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ''
  return endStr ? `${startStr} – ${endStr}` : startStr
}

function formatEventDate(event: GCalEvent): string {
  const raw = event.start.dateTime || event.start.date
  if (!raw) return ''
  const d = new Date(raw)
  return `יום ${DAYS_HE[d.getDay()]}, ${d.getDate()} ב${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export const ShirMeetings: React.FC<ShirMeetingsProps> = ({ couples }) => {
  const [gapiReady, setGapiReady] = useState(false)
  const [gisReady, setGisReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [events, setEvents] = useState<GCalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'week'>('list')
  const [weekOffset, setWeekOffset] = useState(0)
  const [form, setForm] = useState<NewEventForm>({
    title: '', date: todayStr(), startTime: '10:00', endTime: '11:00',
    location: '', description: '', coupleId: '',
  })

  const tokenClientRef = useRef<any>(null)

  const noClientId = !GOOGLE_CLIENT_ID

  // Load gapi script
  useEffect(() => {
    if (noClientId) return
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => {
      (window as any).gapi.load('client', async () => {
        await (window as any).gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC],
        })
        setGapiReady(true)
      })
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [noClientId])

  // Load GIS script
  useEffect(() => {
    if (noClientId) return
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => {
      tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (resp: any) => {
          if (resp.error) { setError('שגיאת התחברות: ' + resp.error); return }
          setSignedIn(true)
          await loadEvents()
        },
      })
      setGisReady(true)
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [noClientId])

  const handleSignIn = useCallback(() => {
    if (!tokenClientRef.current) return
    tokenClientRef.current.requestAccessToken({ prompt: 'consent' })
  }, [])

  const handleSignOut = useCallback(() => {
    const token = (window as any).gapi?.client?.getToken()
    if (token) (window as any).google.accounts.oauth2.revoke(token.access_token)
    ;(window as any).gapi?.client?.setToken(null)
    setSignedIn(false)
    setEvents([])
  }, [])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 4, 0).toISOString()
      const resp = await (window as any).gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        showDeleted: false,
        singleEvents: true,
        maxResults: 200,
        orderBy: 'startTime',
      })
      setEvents(resp.result.items || [])
    } catch (e: any) {
      setError('שגיאה בטעינת הפגישות: ' + (e?.result?.error?.message || String(e)))
    }
    setLoading(false)
  }, [])

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const couple = couples.find(c => c.id === form.coupleId)
      const coupleName = couple
        ? (couple.couple_name || `${couple.partner1_name} ו${couple.partner2_name}`)
        : ''

      const description = [
        form.description,
        coupleName ? `זוג: ${coupleName}` : '',
      ].filter(Boolean).join('\n')

      const startDT = `${form.date}T${form.startTime}:00`
      const endDT = `${form.date}T${form.endTime}:00`

      await (window as any).gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: {
          summary: form.title,
          description: description || undefined,
          location: form.location || undefined,
          start: { dateTime: startDT, timeZone: 'Asia/Jerusalem' },
          end: { dateTime: endDT, timeZone: 'Asia/Jerusalem' },
        },
      })

      setForm({ title: '', date: todayStr(), startTime: '10:00', endTime: '11:00', location: '', description: '', coupleId: '' })
      setShowForm(false)
      await loadEvents()
    } catch (e: any) {
      setError('שגיאה ביצירת אירוע: ' + (e?.result?.error?.message || String(e)))
    }
    setSaving(false)
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('למחוק פגישה זו מגוגל קלנדר?')) return
    try {
      await (window as any).gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId,
      })
      setEvents(prev => prev.filter(ev => ev.id !== eventId))
    } catch (e: any) {
      setError('שגיאה במחיקה: ' + (e?.result?.error?.message || String(e)))
    }
  }

  // ---- Week view helpers ----
  const weekStart = startOfWeek(new Date(Date.now() + weekOffset * 7 * 24 * 3600 * 1000))
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const eventsForDay = (day: Date) =>
    events.filter(ev => {
      const raw = ev.start.dateTime || ev.start.date
      if (!raw) return false
      return isSameDay(new Date(raw), day)
    })

  // ---- Upcoming list (next 30 days) ----
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000)
  const upcomingEvents = events.filter(ev => {
    const raw = ev.start.dateTime || ev.start.date
    if (!raw) return false
    const d = new Date(raw)
    return d >= now && d <= in30
  })

  // ---- Not configured screen ----
  if (noClientId) {
    return (
      <div className="sm-page" dir="rtl">
        <div className="sm-setup-card">
          <div className="sm-setup-icon">📅</div>
          <h2>סנכרון עם גוגל קלנדר</h2>
          <p>כדי להפעיל את הסנכרון עם Google Calendar, צריך להגדיר Google Client ID.</p>
          <div className="sm-setup-steps">
            <div className="sm-step">
              <span className="sm-step-num">1</span>
              <span>לך ל- <strong>console.cloud.google.com</strong> וצור פרויקט חדש</span>
            </div>
            <div className="sm-step">
              <span className="sm-step-num">2</span>
              <span>APIs &amp; Services → Enable APIs → חפש <strong>"Google Calendar API"</strong> → Enable</span>
            </div>
            <div className="sm-step">
              <span className="sm-step-num">3</span>
              <span>APIs &amp; Services → Credentials → Create Credentials → <strong>OAuth 2.0 Client ID</strong></span>
            </div>
            <div className="sm-step">
              <span className="sm-step-num">4</span>
              <span>Application type: <strong>Web application</strong><br />Authorized origins: <code>http://localhost:3000</code></span>
            </div>
            <div className="sm-step">
              <span className="sm-step-num">5</span>
              <span>העתיקי את ה-<strong>Client ID</strong> והוסיפי לקובץ <code>.env</code>:<br />
                <code>VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE</code>
              </span>
            </div>
          </div>
          <p className="sm-setup-note">לאחר ההגדרה הפעילי מחדש את <code>npm run dev</code> — הכפתור יופיע אוטומטית.</p>
        </div>
      </div>
    )
  }

  // ---- Sign-in screen ----
  if (!signedIn) {
    return (
      <div className="sm-page" dir="rtl">
        <div className="sm-setup-card">
          <div className="sm-setup-icon">📅</div>
          <h2>פגישות — גוגל קלנדר</h2>
          <p>התחברי עם חשבון Google שלך כדי לראות ולנהל פגישות ישירות מכאן.</p>
          <button
            className="sm-signin-btn"
            onClick={handleSignIn}
            disabled={!gapiReady || !gisReady}
          >
            {(!gapiReady || !gisReady) ? 'טוען...' : '🔗 התחברי עם Google'}
          </button>
          {error && <p className="sm-error">{error}</p>}
        </div>
      </div>
    )
  }

  // ---- Main calendar view ----
  return (
    <div className="sm-page" dir="rtl">
      <div className="sm-header">
        <div className="sm-title-row">
          <h2 className="sm-title">פגישות 📅</h2>
          <span className="sm-gcal-badge">🔗 Google Calendar</span>
        </div>
        <div className="sm-header-actions">
          <div className="sm-view-toggle">
            <button className={`sm-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>רשימה</button>
            <button className={`sm-view-btn ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')}>שבוע</button>
          </div>
          <button className="sm-add-btn" onClick={() => setShowForm(s => !s)}>
            {showForm ? '✕ ביטול' : '+ פגישה חדשה'}
          </button>
          <button className="sm-refresh-btn" onClick={loadEvents} title="רענן">↻</button>
          <button className="sm-signout-btn" onClick={handleSignOut}>התנתק</button>
        </div>
      </div>

      {error && <div className="sm-error-bar">{error} <button onClick={() => setError(null)}>✕</button></div>}

      {/* New event form */}
      {showForm && (
        <form className="sm-form" onSubmit={handleAddEvent} dir="rtl">
          <div className="sm-form-title">פגישה חדשה</div>
          <div className="sm-form-row">
            <input className="sm-input sm-input-wide" type="text" placeholder="כותרת הפגישה *" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className="sm-form-row">
            <div className="sm-form-group">
              <label>תאריך</label>
              <input className="sm-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
            </div>
            <div className="sm-form-group">
              <label>שעת התחלה</label>
              <input className="sm-input" type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
            </div>
            <div className="sm-form-group">
              <label>שעת סיום</label>
              <input className="sm-input" type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
            </div>
          </div>
          <div className="sm-form-row">
            <div className="sm-form-group sm-form-group-wide">
              <label>מקום</label>
              <input className="sm-input" type="text" placeholder="כתובת או שם המקום" value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            </div>
            <div className="sm-form-group sm-form-group-wide">
              <label>זוג קשור</label>
              <select className="sm-input" value={form.coupleId} onChange={e => setForm(p => ({ ...p, coupleId: e.target.value }))}>
                <option value="">ללא זוג ספציפי</option>
                {couples.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.couple_name || `${c.partner1_name} ו${c.partner2_name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="sm-form-row">
            <div className="sm-form-group sm-form-group-full">
              <label>הערות</label>
              <textarea className="sm-input sm-textarea" placeholder="פרטים נוספים..." value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <div className="sm-form-footer">
            <button type="submit" className="sm-submit-btn" disabled={saving}>
              {saving ? 'שומר...' : '📅 הוסיפי לגוגל קלנדר'}
            </button>
          </div>
        </form>
      )}

      {loading && <div className="sm-loading">טוען פגישות...</div>}

      {/* WEEK VIEW */}
      {!loading && viewMode === 'week' && (
        <div className="sm-week-wrap">
          <div className="sm-week-nav">
            <button className="sm-nav-btn" onClick={() => setWeekOffset(o => o - 1)}>→ שבוע קודם</button>
            <span className="sm-week-label">
              {weekDays[0].getDate()} {MONTHS_HE[weekDays[0].getMonth()]} – {weekDays[6].getDate()} {MONTHS_HE[weekDays[6].getMonth()]} {weekDays[6].getFullYear()}
            </span>
            <button className="sm-nav-btn" onClick={() => setWeekOffset(o => o + 1)}>שבוע הבא ←</button>
          </div>
          <div className="sm-week-grid">
            {weekDays.map((day, i) => {
              const dayEvents = eventsForDay(day)
              const isToday = isSameDay(day, new Date())
              return (
                <div key={i} className={`sm-week-day ${isToday ? 'sm-week-today' : ''}`}>
                  <div className="sm-week-day-header">
                    <span className="sm-week-day-name">{DAYS_HE[day.getDay()]}</span>
                    <span className={`sm-week-day-num ${isToday ? 'sm-today-num' : ''}`}>{day.getDate()}</span>
                  </div>
                  <div className="sm-week-day-events">
                    {dayEvents.length === 0 && <span className="sm-week-empty">—</span>}
                    {dayEvents.map(ev => (
                      <div key={ev.id} className="sm-week-event" title={ev.summary}>
                        <span className="sm-week-event-time">{formatEventTime(ev)}</span>
                        <span className="sm-week-event-title">{ev.summary}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {!loading && viewMode === 'list' && (
        <div className="sm-list-wrap">
          <div className="sm-section-title">30 הימים הקרובים</div>
          {upcomingEvents.length === 0 && (
            <div className="sm-empty">אין פגישות קרובות — הוסיפי פגישה חדשה!</div>
          )}
          <div className="sm-events-list">
            {upcomingEvents.map(ev => (
              <EventCard key={ev.id} event={ev} onDelete={handleDeleteEvent} />
            ))}
          </div>

          {events.filter(ev => {
            const raw = ev.start.dateTime || ev.start.date
            if (!raw) return false
            return new Date(raw) > in30
          }).length > 0 && (
            <>
              <div className="sm-section-title" style={{ marginTop: 28 }}>פגישות עתידיות</div>
              <div className="sm-events-list">
                {events
                  .filter(ev => {
                    const raw = ev.start.dateTime || ev.start.date
                    if (!raw) return false
                    return new Date(raw) > in30
                  })
                  .map(ev => (
                    <EventCard key={ev.id} event={ev} onDelete={handleDeleteEvent} />
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ---- EventCard sub-component ---- */
interface EventCardProps {
  event: GCalEvent
  onDelete: (id: string) => void
}

const EventCard: React.FC<EventCardProps> = ({ event, onDelete }) => {
  const dateStr = formatEventDate(event)
  const timeStr = formatEventTime(event)
  const raw = event.start.dateTime || event.start.date
  const isToday = raw ? isSameDay(new Date(raw), new Date()) : false

  return (
    <div className={`sm-event-card ${isToday ? 'sm-event-today' : ''}`}>
      <div className="sm-event-date-col">
        <span className="sm-event-day-name">{raw ? DAYS_HE[new Date(raw).getDay()] : ''}</span>
        <span className="sm-event-day-num">{raw ? new Date(raw).getDate() : ''}</span>
        <span className="sm-event-month">{raw ? MONTHS_HE[new Date(raw).getMonth()] : ''}</span>
      </div>
      <div className="sm-event-body">
        <div className="sm-event-title">{event.summary}</div>
        <div className="sm-event-meta">
          {timeStr && <span className="sm-event-time">🕐 {timeStr}</span>}
          {event.location && <span className="sm-event-loc">📍 {event.location}</span>}
        </div>
        {event.description && <div className="sm-event-desc">{event.description}</div>}
      </div>
      <div className="sm-event-actions">
        <a href={event.htmlLink} target="_blank" rel="noreferrer" className="sm-event-open" title="פתח בגוגל קלנדר">↗</a>
        <button className="sm-event-delete" onClick={() => onDelete(event.id)} title="מחק">✕</button>
      </div>
    </div>
  )
}
