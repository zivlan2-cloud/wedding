import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/CoupleForm.css'

const SLIDES = [
  '/images/1.jpeg',
  '/images/2.jpeg',
  '/images/3.jpeg',
  '/images/4.jpeg',
  '/images/5.jpeg',
  '/images/6.jpeg',
  '/images/7.jpeg',
]

const LANDING_LINK = window.location.origin
const LANDING_WA_TEXT = encodeURIComponent(
  `✨ היי! 💍\n\nאני שיר, מפיקת חתונות.\nאם אתם בתהליך תכנון החתונה שלכם ורוצים לשמוע עוד — שמחה להכיר!\n\nמלאו את השאלון הקצר שלי, ואחזור אליכם בהקדם 🎊\n\n${LANDING_LINK}`
)

const STEPS = [
  { id: 'names', title: 'אז תגידו רגע, איך קוראים לכם? 💑' },
  { id: 'ages', title: 'בני כמה קיצים אתם?' },
  { id: 'phone', title: 'מספר טלפון ליצירת קשר 📱' },
  { id: 'venue', title: 'יש לכם כבר מקום לאירוע?' },
  { id: 'guests', title: 'אז כמה אורחים להערכתכם יגיעו לחתונה? 🎉' },
  { id: 'vision', title: 'ספרו לנו על החתונה שאתם חולמים עליה ✨' },
  { id: 'vendors', title: 'מה הדבר הכי חשוב לכם באירוע?' },
  { id: 'producer_role', title: 'איך אתם תופסים את התפקיד של מפיקה? 🎯' },
  { id: 'budget', title: 'כמה חשבתם להוציא על החתונה? 💰' },
]

export const CoupleForm: React.FC = () => {
  const [screen, setScreen] = useState<'welcome' | 'form'>('welcome')
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slideIndex, setSlideIndex] = useState(0)
  const [copied, setCopied] = useState(false)

  const [data, setData] = useState({
    partner1_name: '', partner1_role: 'חתן',
    partner2_name: '', partner2_role: 'כלה',
    partner1_last_name: '', partner2_last_name: '',
    partner1_id: '', partner2_id: '',
    partner1_age: '', partner2_age: '',
    phone: '',
    has_venue: '', venue_name: '', venue_cost: '',
    estimated_guests: '', wedding_vision: '',
    important_vendors: '', producer_role: '', budget: '',
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIndex(i => (i + 1) % SLIDES.length)
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  const set = (field: string, value: string) =>
    setData(prev => ({ ...prev, [field]: value }))

  const canProceed = () => {
    switch (STEPS[step].id) {
      case 'names': return data.partner1_name.trim() && data.partner2_name.trim()
      case 'ages': return data.partner1_age && data.partner2_age
      case 'phone': return data.phone.trim()
      case 'venue': return data.has_venue !== ''
      case 'guests': return data.estimated_guests !== ''
      case 'vision': return data.wedding_vision.trim()
      case 'vendors': return data.important_vendors.trim()
      case 'producer_role': return data.producer_role.trim()
      case 'budget': return data.budget !== ''
      default: return true
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('couples').insert([{
        partner1_name: data.partner1_name,
        partner1_last_name: data.partner1_last_name || null,
        partner1_id: data.partner1_id || null,
        partner2_name: data.partner2_name,
        partner2_last_name: data.partner2_last_name || null,
        partner2_id: data.partner2_id || null,
        couple_name: `${data.partner1_name} ו${data.partner2_name}`,
        partner1_age: parseInt(data.partner1_age) || null,
        partner2_age: parseInt(data.partner2_age) || null,
        how_met: null,
        phone: data.phone,
        has_venue: data.has_venue === 'yes',
        venue_name: data.has_venue === 'yes' ? data.venue_name : null,
        venue_cost: data.has_venue === 'yes' && data.venue_cost ? parseFloat(data.venue_cost) : null,
        estimated_guests: parseInt(data.estimated_guests) || null,
        guest_count: parseInt(data.estimated_guests) || 0,
        wedding_vision: data.wedding_vision,
        important_vendors: data.important_vendors,
        producer_role_vision: data.producer_role,
        budget: parseFloat(data.budget) || 0,
        wedding_style: 'לא צוין',
        event_date: '2099-01-01',
        status: 'מתלבטים',
      }])
      if (err) throw err
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירה')
    } finally {
      setLoading(false)
    }
  }

  // Thank you
  if (submitted) {
    return (
      <div className="cf-form-page">
        <div className="cf-form-bg">
          {SLIDES.map((src, i) => (
            <div key={i} className={`cf-form-bg-slide ${i === slideIndex ? 'active' : ''}`} style={{ backgroundImage: `url(${src})` }} />
          ))}
          <div className="cf-form-overlay" />
        </div>
        <div className="cf-thank-card">
          <div className="cf-heart">✿</div>
          <h2>תודה על המענה!</h2>
          <p>
            אני בטוחה שזה יסייע ויתן לי להכיר אתכם עוד קצת.<br />
            אם לא דיברנו בטלפון — בואו נקבע שיחה,<br />
            ואם תרצו להתחיל לרוץ יחד — נתחיל לתכנן לכם את היום המטורף הזה 🎊
          </p>
          <a href={`https://wa.me/972508890134?text=${encodeURIComponent('יאללה שיר בואי נעשה חתונה ביחד!')}`} className="cf-btn cf-btn-primary" target="_blank" rel="noreferrer">
            💬 דברו איתי בוואטסאפ
          </a>
        </div>
      </div>
    )
  }

  // Welcome screen — split layout
  if (screen === 'welcome') {
    return (
      <div className="cf-page">
        <div className="cf-welcome">
          {/* Right — text panel */}
          <div className="cf-welcome-right">
            {/* Decorative botanical corner */}
            <svg className="cf-botanical-corner" width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position:'absolute', top:0, left:0, pointerEvents:'none', opacity:0.18 }}>
              <path d="M10 130 C20 90, 50 50, 130 10" stroke="#7D5C3C" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              <path d="M10 130 C30 100, 60 80, 80 40" stroke="#A07850" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
              <ellipse cx="55" cy="65" rx="18" ry="8" fill="#7D5C3C" opacity="0.5" transform="rotate(-45 55 65)"/>
              <ellipse cx="85" cy="35" rx="14" ry="7" fill="#E8C4B8" opacity="0.7" transform="rotate(-50 85 35)"/>
              <ellipse cx="30" cy="100" rx="16" ry="7" fill="#7D5C3C" opacity="0.4" transform="rotate(-35 30 100)"/>
              <circle cx="110" cy="15" r="4" fill="#E8D5C0" opacity="0.8"/>
              <circle cx="15" cy="120" r="3" fill="#A07850" opacity="0.6"/>
            </svg>
            <p className="cf-tagline">Wedding Producer</p>
            <h1 className="cf-welcome-title">שיר</h1>
            <p className="cf-welcome-subtitle">מפיקת חתונות</p>
            <div className="cf-divider" />
            <p className="cf-welcome-text">
              שלום לכם חמודים 👋<br />
              אני שיר — נשואה לזיו, אמא לנטע וגפן ומפיקה.<br />
              הפשן שלי זה לייצר מרחבים שמגשימים לאנשים את החלומות שלהם,
              וחתונה זו הזדמנות מדהימה בדיוק לזה ✨<br /><br />
              בואו נתחיל להבין מה אתם מחפשים בחתונה שלכם 💫
            </p>
            <button className="cf-btn cf-start-btn" onClick={() => setScreen('form')}>
              בואו נתחיל ←
            </button>
            <div className="cf-share-bar">
              <span>שתפי:</span>
              <a href={`https://wa.me/?text=${LANDING_WA_TEXT}`} className="cf-share-wa" target="_blank" rel="noreferrer">
                💬 וואטסאפ
              </a>
              <button className="cf-share-copy" onClick={() => { navigator.clipboard.writeText(LANDING_LINK); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
                {copied ? '✓ הועתק!' : '🔗 קישור'}
              </button>
              <a href="https://www.instagram.com/shir_miloproductions" className="cf-share-ig" target="_blank" rel="noreferrer">
                📸 אינסטגרם
              </a>
            </div>
          </div>

          {/* Left — slideshow */}
          <div className="cf-welcome-left">
            {SLIDES.map((src, i) => (
              <div key={i} className={`cf-slide ${i === slideIndex ? 'active' : ''}`} style={{ backgroundImage: `url(${src})` }} />
            ))}
            <div className="cf-slide-dots">
              {SLIDES.map((_, i) => (
                <button key={i} className={`cf-dot ${i === slideIndex ? 'active' : ''}`} onClick={() => setSlideIndex(i)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Form screen
  const progress = (step / STEPS.length) * 100

  return (
    <div className="cf-form-page">
      <div className="cf-form-bg">
        {SLIDES.map((src, i) => (
          <div key={i} className={`cf-form-bg-slide ${i === slideIndex ? 'active' : ''}`} style={{ backgroundImage: `url(${src})` }} />
        ))}
        <div className="cf-form-overlay" />
      </div>

      <div className="cf-form-screen">
        <div className="cf-form-top">
          <span className="cf-form-brand">שיר ✦ מפיקה</span>
          <div className="cf-progress-wrap">
            <div className="cf-progress-bar">
              <div className="cf-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="cf-step-count">שאלה {step + 1} מתוך {STEPS.length}</p>
          </div>
        </div>

        <div className="cf-card">
          <h2 className="cf-question">{STEPS[step].title}</h2>

          {STEPS[step].id === 'names' && (
            <div className="cf-fields">
              <div className="cf-name-row">
                <div>
                  <div className="cf-role-toggle">
                    <button className={`cf-role-btn ${data.partner1_role === 'חתן' ? 'active' : ''}`} onClick={() => set('partner1_role', 'חתן')}>חתן</button>
                    <button className={`cf-role-btn ${data.partner1_role === 'כלה' ? 'active' : ''}`} onClick={() => set('partner1_role', 'כלה')}>כלה</button>
                  </div>
                  <input className="cf-input" placeholder={`שם פרטי של ה${data.partner1_role}`} value={data.partner1_name} onChange={e => set('partner1_name', e.target.value)} />
                  <input className="cf-input" placeholder="שם משפחה" value={data.partner1_last_name} onChange={e => set('partner1_last_name', e.target.value)} style={{ marginTop: 8 }} />
                  <input className="cf-input" placeholder="מספר תעודת זהות" value={data.partner1_id} onChange={e => set('partner1_id', e.target.value)} style={{ marginTop: 8 }} />
                </div>
                <div>
                  <div className="cf-role-toggle">
                    <button className={`cf-role-btn ${data.partner2_role === 'חתן' ? 'active' : ''}`} onClick={() => set('partner2_role', 'חתן')}>חתן</button>
                    <button className={`cf-role-btn ${data.partner2_role === 'כלה' ? 'active' : ''}`} onClick={() => set('partner2_role', 'כלה')}>כלה</button>
                  </div>
                  <input className="cf-input" placeholder={`שם פרטי של ה${data.partner2_role}`} value={data.partner2_name} onChange={e => set('partner2_name', e.target.value)} />
                  <input className="cf-input" placeholder="שם משפחה" value={data.partner2_last_name} onChange={e => set('partner2_last_name', e.target.value)} style={{ marginTop: 8 }} />
                  <input className="cf-input" placeholder="מספר תעודת זהות" value={data.partner2_id} onChange={e => set('partner2_id', e.target.value)} style={{ marginTop: 8 }} />
                </div>
              </div>
            </div>
          )}

          {STEPS[step].id === 'ages' && (
            <div className="cf-fields cf-fields-row">
              <div>
                <label className="cf-label">{data.partner1_name || 'בן/בת זוג ראשון/ת'}</label>
                <input className="cf-input" type="number" placeholder="גיל" value={data.partner1_age} onChange={e => set('partner1_age', e.target.value)} />
              </div>
              <div>
                <label className="cf-label">{data.partner2_name || 'בן/בת זוג שני/ה'}</label>
                <input className="cf-input" type="number" placeholder="גיל" value={data.partner2_age} onChange={e => set('partner2_age', e.target.value)} />
              </div>
            </div>
          )}

          {STEPS[step].id === 'phone' && (
            <input className="cf-input" type="tel" placeholder="050-0000000" value={data.phone} onChange={e => set('phone', e.target.value)} />
          )}

          {STEPS[step].id === 'venue' && (
            <div className="cf-fields">
              <div className="cf-radio-group">
                <button className={`cf-radio ${data.has_venue === 'yes' ? 'active' : ''}`} onClick={() => set('has_venue', 'yes')}>כן, יש לנו מקום</button>
                <button className={`cf-radio ${data.has_venue === 'no' ? 'active' : ''}`} onClick={() => set('has_venue', 'no')}>עדיין לא</button>
              </div>
              {data.has_venue === 'yes' && (
                <>
                  <input className="cf-input" placeholder="שם המקום / כתובת" value={data.venue_name} onChange={e => set('venue_name', e.target.value)} />
                  <input className="cf-input" type="number" placeholder="עלות המקום (₪)" value={data.venue_cost} onChange={e => set('venue_cost', e.target.value)} />
                </>
              )}
            </div>
          )}

          {STEPS[step].id === 'guests' && (
            <div className="cf-fields">
              <p className="cf-hint">חשבו בערך — לא צריך להיות מדויק, רק רושם כללי. אפשר גם לבדוק רשימות 😊</p>
              <input className="cf-input" type="number" placeholder="כמות אורחים מוערכת" value={data.estimated_guests} onChange={e => set('estimated_guests', e.target.value)} />
            </div>
          )}

          {STEPS[step].id === 'vision' && (
            <textarea className="cf-textarea" placeholder="מה חשוב לכם שיהיה בחתונה, או איך אתם מדמיינים אותה בקווים כלליים..." value={data.wedding_vision} onChange={e => set('wedding_vision', e.target.value)} rows={4} />
          )}

          {STEPS[step].id === 'vendors' && (
            <div className="cf-fields">
              <p className="cf-hint">אוכל, מוזיקה, עיצוב, אמנות — מה הכי שורף אתכם? 🔥</p>
              <textarea className="cf-textarea" placeholder="מה הכי חשוב לנו..." value={data.important_vendors} onChange={e => set('important_vendors', e.target.value)} rows={3} />
            </div>
          )}

          {STEPS[step].id === 'producer_role' && (
            <div className="cf-fields">
              <p className="cf-hint">אין תשובה נכונה או שגויה — רק רוצה להבין איך אתם רואים את השותפות 🤝</p>
              <textarea className="cf-textarea" placeholder="לדעתנו מפיקת חתונות היא..." value={data.producer_role} onChange={e => set('producer_role', e.target.value)} rows={3} />
            </div>
          )}

          {STEPS[step].id === 'budget' && (
            <div className="cf-fields">
              <p className="cf-hint">כמה כסף חשבתם להוציא על האירוע בסך הכל?</p>
              <input className="cf-input" type="number" placeholder="תקציב מוערך (₪)" value={data.budget} onChange={e => set('budget', e.target.value)} />
            </div>
          )}

          {error && <p className="cf-error">{error}</p>}

          <div className="cf-actions">
            <button className="cf-btn cf-btn-back" onClick={() => step === 0 ? setScreen('welcome') : setStep(s => s - 1)}>
              חזור
            </button>
            {step < STEPS.length - 1 ? (
              <button className="cf-btn cf-btn-primary" disabled={!canProceed()} onClick={() => setStep(s => s + 1)}>הבא ←</button>
            ) : (
              <button className="cf-btn cf-btn-primary" disabled={!canProceed() || loading} onClick={handleSubmit}>
                {loading ? 'שולח...' : 'שליחה 🎉'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
