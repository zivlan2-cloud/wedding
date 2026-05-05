import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Vendor } from '../types'
import '../styles/VendorManagement.css'

interface VendorManagementProps {
  weddingId: string
  weddingName: string
}

export const VendorManagement: React.FC<VendorManagementProps> = ({ weddingId, weddingName }) => {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    vendor_name: '',
    vendor_type: '',
    contract_amount: '',
    amount_paid: '',
    notes: ''
  })
  const [file, setFile] = useState<File | null>(null)

  const vendorTypes = ['צלם', 'מוזיקה ודי ג׳י', 'הפקה', 'קייטרינג', 'פרחים', 'הלבשה', 'שיער ומקיאז', 'אחר']

  useEffect(() => {
    fetchVendors()
  }, [weddingId])

  const fetchVendors = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('vendors')
        .select('*')
        .eq('wedding_id', weddingId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setVendors(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vendors')
    } finally {
      setLoading(false)
    }
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleAddVendor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let fileUrl = null

      // Upload contract file if provided
      if (file) {
        const fileName = `${weddingId}/${Date.now()}_${file.name}`
        const { error: uploadError, data } = await supabase.storage
          .from('contracts')
          .upload(fileName, file)

        if (uploadError) throw uploadError
        
        const { data: urlData } = supabase.storage
          .from('contracts')
          .getPublicUrl(fileName)
        fileUrl = urlData?.publicUrl
      }

      const { data, error: insertError } = await supabase
        .from('vendors')
        .insert([
          {
            wedding_id: weddingId,
            vendor_name: formData.vendor_name,
            vendor_type: formData.vendor_type,
            contract_amount: parseFloat(formData.contract_amount),
            amount_paid: parseFloat(formData.amount_paid),
            contract_file_url: fileUrl,
            notes: formData.notes
          }
        ])
        .select()

      if (insertError) throw insertError

      if (data && data.length > 0) {
        setVendors(prev => [data[0], ...prev])
      }

      setFormData({
        vendor_name: '',
        vendor_type: '',
        contract_amount: '',
        amount_paid: '',
        notes: ''
      })
      setFile(null)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add vendor')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteVendor = async (vendorId: string) => {
    if (!confirm('למחוק את הספק?')) return

    try {
      const { error: deleteError } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId)

      if (deleteError) throw deleteError
      setVendors(prev => prev.filter(v => v.id !== vendorId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete vendor')
    }
  }

  return (
    <div className="vendor-management">
      <h2>ניהול ספקים - {weddingName}</h2>
      
      {error && <div className="alert alert-error">{error}</div>}

      <button
        onClick={() => setShowForm(!showForm)}
        className="btn btn-primary"
      >
        {showForm ? 'ביטול' : 'הוסף ספק חדש'}
      </button>

      {showForm && (
        <form onSubmit={handleAddVendor} className="vendor-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="vendor_name">שם הספק *</label>
              <input
                type="text"
                id="vendor_name"
                name="vendor_name"
                value={formData.vendor_name}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="vendor_type">סוג ספק *</label>
              <select
                id="vendor_type"
                name="vendor_type"
                value={formData.vendor_type}
                onChange={handleFormChange}
                required
              >
                <option value="">בחר סוג</option>
                {vendorTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="contract_amount">סכום החוזה (₪) *</label>
              <input
                type="number"
                id="contract_amount"
                name="contract_amount"
                value={formData.contract_amount}
                onChange={handleFormChange}
                min="0"
                step="100"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="amount_paid">סכום ששולם (₪) *</label>
              <input
                type="number"
                id="amount_paid"
                name="amount_paid"
                value={formData.amount_paid}
                onChange={handleFormChange}
                min="0"
                step="100"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="contract_file">העלאת קובץ חוזה</label>
            <input
              type="file"
              id="contract_file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.png"
            />
            {file && <p className="file-name">נבחר: {file.name}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="notes">הערות</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleFormChange}
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-success"
          >
            {loading ? 'שומר...' : 'שמור ספק'}
          </button>
        </form>
      )}

      <div className="vendors-list">
        {loading && !showForm ? <p>טוען...</p> : null}
        {vendors.length === 0 && !loading ? (
          <p className="empty-state">אין ספקים עדיין</p>
        ) : (
          vendors.map(vendor => (
            <div key={vendor.id} className="vendor-card">
              <div className="vendor-header">
                <h3>{vendor.vendor_name}</h3>
                <span className="vendor-type">{vendor.vendor_type}</span>
              </div>

              <div className="vendor-details">
                <div className="detail">
                  <span className="label">סכום החוזה:</span>
                  <span className="value">₪{vendor.contract_amount.toLocaleString()}</span>
                </div>
                <div className="detail">
                  <span className="label">סכום ששולם:</span>
                  <span className="value">₪{vendor.amount_paid.toLocaleString()}</span>
                </div>
                <div className="detail">
                  <span className="label">יתרה:</span>
                  <span className={`value ${vendor.contract_amount - vendor.amount_paid > 0 ? 'due' : 'paid'}`}>
                    ₪{(vendor.contract_amount - vendor.amount_paid).toLocaleString()}
                  </span>
                </div>
              </div>

              {vendor.notes && <p className="notes">{vendor.notes}</p>}

              <div className="vendor-actions">
                {vendor.contract_file_url && (
                  <a href={vendor.contract_file_url} target="_blank" rel="noopener noreferrer" className="btn btn-small">
                    צפה בחוזה
                  </a>
                )}
                <button
                  onClick={() => handleDeleteVendor(vendor.id)}
                  className="btn btn-small btn-danger"
                >
                  מחק
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
