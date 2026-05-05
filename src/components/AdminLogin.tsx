import React, { useState } from 'react'
import '../styles/AdminLogin.css'

const PASSWORD = 'זיו הוא בעלי ואני אוהבת אותו'

interface AdminLoginProps {
  onLogin: () => void
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value === PASSWORD) {
      sessionStorage.setItem('shir_auth', '1')
      onLogin()
    } else {
      setError(true)
      setValue('')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-icon">💍</div>
        <h2>כניסה לאזור הניהול</h2>
        <p>אזור זה מיועד לשיר בלבד</p>
        <form onSubmit={handleSubmit}>
          <input
            className="login-input"
            type="password"
            placeholder="סיסמה"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false) }}
            autoFocus
          />
          {error && <p className="login-error">סיסמה שגויה</p>}
          <button className="login-btn" type="submit">כניסה</button>
        </form>
      </div>
    </div>
  )
}
