import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { supabase } from '../lib/supabase'
import { Couple, Vendor } from '../types'
import '../styles/Dashboard.css'

const COLORS = ['#6c63ff', '#48cae4', '#f72585', '#4cc9f0', '#f8961e', '#90be6d', '#e63946']

interface WeddingStat {
  couple: Couple
  vendors: Vendor[]
  totalContract: number
  totalPaid: number
  remaining: number
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<WeddingStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { data: couples, error: cErr } = await supabase
        .from('couples')
        .select('*')
        .order('event_date', { ascending: true })

      if (cErr) throw cErr

      const { data: vendors, error: vErr } = await supabase
        .from('vendors')
        .select('*')

      if (vErr) throw vErr

      const result: WeddingStat[] = (couples || []).map((couple) => {
        const wVendors = (vendors || []).filter(v => v.wedding_id === couple.id)
        const totalContract = wVendors.reduce((s, v) => s + v.contract_amount, 0)
        const totalPaid = wVendors.reduce((s, v) => s + v.amount_paid, 0)
        return {
          couple,
          vendors: wVendors,
          totalContract,
          totalPaid,
          remaining: totalContract - totalPaid
        }
      })

      setStats(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת נתונים')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">טוען דשבורד...</div>
  if (error) return <div className="alert alert-error">{error}</div>

  const totalBudget = stats.reduce((s, w) => s + w.couple.budget, 0)
  const totalContract = stats.reduce((s, w) => s + w.totalContract, 0)
  const totalPaid = stats.reduce((s, w) => s + w.totalPaid, 0)
  const totalRemaining = totalContract - totalPaid

  const budgetBarData = stats.map(w => ({
    name: w.couple.couple_name,
    תקציב: w.couple.budget,
    'סכום חוזים': w.totalContract,
    שולם: w.totalPaid
  }))

  const styleMap: Record<string, number> = {}
  stats.forEach(w => {
    styleMap[w.couple.wedding_style] = (styleMap[w.couple.wedding_style] || 0) + 1
  })
  const stylePieData = Object.entries(styleMap).map(([name, value]) => ({ name, value }))

  const now = new Date()
  const upcomingCount = stats.filter(
    w => new Date(w.couple.event_date) >= now
  ).length

  return (
    <div className="dashboard">
      <h2>דשבורד כללי</h2>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-icon">💍</span>
          <div>
            <p className="kpi-label">חתונות פעילות</p>
            <p className="kpi-value">{stats.length}</p>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon">📅</span>
          <div>
            <p className="kpi-label">חתונות קרובות</p>
            <p className="kpi-value">{upcomingCount}</p>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon">💰</span>
          <div>
            <p className="kpi-label">סה"כ תקציבים</p>
            <p className="kpi-value">₪{totalBudget.toLocaleString()}</p>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon">✅</span>
          <div>
            <p className="kpi-label">שולם עד כה</p>
            <p className="kpi-value">₪{totalPaid.toLocaleString()}</p>
          </div>
        </div>
        <div className="kpi-card kpi-alert">
          <span className="kpi-icon">⏳</span>
          <div>
            <p className="kpi-label">יתרה לתשלום</p>
            <p className="kpi-value">₪{totalRemaining.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {stats.length === 0 ? (
        <div className="empty-dashboard">
          <p>אין חתונות עדיין. <a href="/new">הוסף זוג חדש</a> כדי להתחיל.</p>
        </div>
      ) : (
        <>
          <div className="charts-row">
            <div className="chart-card">
              <h3>תקציב מול חוזים מול תשלום — לפי חתונה</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={budgetBarData} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" />
                  <YAxis tickFormatter={v => `₪${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `₪${v.toLocaleString()}`} />
                  <Legend verticalAlign="top" />
                  <Bar dataKey="תקציב" fill="#6c63ff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="סכום חוזים" fill="#48cae4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="שולם" fill="#90be6d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>פילוח סגנונות חתונה</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stylePieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stylePieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="weddings-table-card">
            <h3>רשימת חתונות</h3>
            <table className="weddings-table">
              <thead>
                <tr>
                  <th>שם הזוג</th>
                  <th>תאריך</th>
                  <th>אורחים</th>
                  <th>תקציב</th>
                  <th>חוזים</th>
                  <th>שולם</th>
                  <th>יתרה</th>
                  <th>ספקים</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(w => (
                  <tr key={w.couple.id}>
                    <td>{w.couple.couple_name}</td>
                    <td>{new Date(w.couple.event_date).toLocaleDateString('he-IL')}</td>
                    <td>{w.couple.guest_count}</td>
                    <td>₪{w.couple.budget.toLocaleString()}</td>
                    <td>₪{w.totalContract.toLocaleString()}</td>
                    <td>₪{w.totalPaid.toLocaleString()}</td>
                    <td className={w.remaining > 0 ? 'due' : 'paid'}>
                      ₪{w.remaining.toLocaleString()}
                    </td>
                    <td>{w.vendors.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
