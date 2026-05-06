import React from 'react'
import { Couple } from '../types'
import '../styles/WeddingTimeline.css'

interface WeddingTimelineProps {
  couples: Couple[]
}

const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

export const WeddingTimeline: React.FC<WeddingTimelineProps> = ({ couples }) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcoming = couples
    .filter(c => c.event_date && c.event_date !== '2099-01-01')
    .map(c => ({ ...c, dateObj: new Date(c.event_date) }))
    .filter(c => c.dateObj >= today)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())

  if (upcoming.length === 0) return null

  const getDaysUntil = (d: Date) => {
    const diff = d.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const formatDate = (d: Date) =>
    `${d.getDate()} ב${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`

  return (
    <div className="wt-wrap">
      <div className="wt-label">חתונות קרובות</div>
      <div className="wt-scroll">
        {upcoming.map((c, i) => {
          const days = getDaysUntil(c.dateObj)
          const isNext = i === 0
          const name = c.couple_name || `${c.partner1_name} ו${c.partner2_name}`
          return (
            <div key={c.id} className={`wt-item ${isNext ? 'wt-item-next' : ''}`}>
              <div className="wt-connector" />
              <div className="wt-dot" />
              <div className="wt-card">
                <div className="wt-couple">{name}</div>
                <div className="wt-date">{formatDate(c.dateObj)}</div>
                {c.venue_name && <div className="wt-venue">📍 {c.venue_name}</div>}
                <div className={`wt-days ${days <= 14 ? 'wt-days-soon' : ''}`}>
                  {days === 0 ? '🎉 היום!' : days === 1 ? 'מחר' : `עוד ${days} ימים`}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
