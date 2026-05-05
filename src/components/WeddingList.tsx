import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Couple } from '../types'
import { VendorManagement } from './VendorManagement'
import '../styles/WeddingList.css'

interface WeddingListProps {
  selectedCouple: Couple | null
  onSelectCouple: (couple: Couple) => void
}

export const WeddingList: React.FC<WeddingListProps> = ({ selectedCouple, onSelectCouple }) => {
  const [couples, setCouples] = useState<Couple[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchCouples()
  }, [])

  const fetchCouples = async () => {
    try {
      const { data, error: err } = await supabase
        .from('couples')
        .select('*')
        .order('event_date', { ascending: true })
      if (err) throw err
      setCouples(data || [])
      if (data && data.length > 0 && !selectedCouple) {
        onSelectCouple(data[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת רשימה')
    } finally {
      setLoading(false)
    }
  }

  const filtered = couples.filter(c =>
    c.couple_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="loading">טוען...</div>
  if (error) return <div className="alert alert-error">{error}</div>

  return (
    <div className="wedding-list-layout">
      <aside className="couples-sidebar">
        <div className="sidebar-header">
          <h2>חתונות</h2>
          <input
            className="search-input"
            type="text"
            placeholder="חיפוש..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="empty-state">לא נמצאו חתונות</p>
        ) : (
          <ul className="couples-list">
            {filtered.map(couple => (
              <li
                key={couple.id}
                className={`couple-item ${selectedCouple?.id === couple.id ? 'active' : ''}`}
                onClick={() => onSelectCouple(couple)}
              >
                <strong>{couple.couple_name}</strong>
                <span className="couple-date">
                  {new Date(couple.event_date).toLocaleDateString('he-IL')}
                </span>
                <span className="couple-guests">{couple.guest_count} אורחים</span>
              </li>
            ))}
          </ul>
        )}

        <a href="/new" className="btn btn-primary sidebar-new-btn">+ זוג חדש</a>
      </aside>

      <section className="vendor-panel">
        {selectedCouple ? (
          <VendorManagement
            weddingId={selectedCouple.id}
            weddingName={selectedCouple.couple_name}
          />
        ) : (
          <div className="no-selection">
            <p>בחר חתונה מהרשימה</p>
          </div>
        )}
      </section>
    </div>
  )
}
