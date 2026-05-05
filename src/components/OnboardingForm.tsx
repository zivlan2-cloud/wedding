import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Couple } from '../types'
import '../styles/OnboardingForm.css'

interface OnboardingFormProps {
  onSuccess?: (couple: Couple) => void
}

export const OnboardingForm: React.FC<OnboardingFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    couple_name: '',
    event_date: '',
    guest_count: '',
    wedding_style: '',
    budget: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { data, error: insertError } = await supabase
        .from('couples')
        .insert([
          {
            couple_name: formData.couple_name,
            event_date: formData.event_date,
            guest_count: parseInt(formData.guest_count),
            wedding_style: formData.wedding_style,
            budget: parseFloat(formData.budget),
            notes: formData.notes
          }
        ])
        .select()

      if (insertError) throw insertError

      setSuccess(true)
      setFormData({
        couple_name: '',
        event_date: '',
        guest_count: '',
        wedding_style: '',
        budget: '',
        notes: ''
      })

      if (data && data.length > 0 && onSuccess) {
        onSuccess(data[0])
      }

      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save couple data')
    } finally {
      setLoading(false)
    }
  }

  const weddingStyles = ['ודאי אחר', 'קלאסי', 'מודרני', 'בוהמי', 'מינימליסט', 'רומנטי']

  return (
    <div className="onboarding-form">
      <h2>רישום זוג חדש</h2>
      
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">הזוג נשמר בהצלחה!</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="couple_name">שם הזוג *</label>
          <input
            type="text"
            id="couple_name"
            name="couple_name"
            value={formData.couple_name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="event_date">תאריך החתונה *</label>
            <input
              type="date"
              id="event_date"
              name="event_date"
              value={formData.event_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="guest_count">מספר אורחים *</label>
            <input
              type="number"
              id="guest_count"
              name="guest_count"
              value={formData.guest_count}
              onChange={handleChange}
              min="1"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="wedding_style">סגנון החתונה *</label>
            <select
              id="wedding_style"
              name="wedding_style"
              value={formData.wedding_style}
              onChange={handleChange}
              required
            >
              <option value="">בחר סגנון</option>
              {weddingStyles.map(style => (
                <option key={style} value={style}>{style}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="budget">תקציב (₪) *</label>
            <input
              type="number"
              id="budget"
              name="budget"
              value={formData.budget}
              onChange={handleChange}
              min="0"
              step="100"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="notes">הערות</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'שומר...' : 'שמור'}
        </button>
      </form>
    </div>
  )
}
