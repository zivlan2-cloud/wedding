import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CoupleForm } from './components/CoupleForm'
import { AdminLogin } from './components/AdminLogin'
import { AdminDashboard } from './components/AdminDashboard'
import { CoupleWorkPage } from './components/CoupleWorkPage'

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('shir_auth') === '1')

  useEffect(() => {
    const onStorage = () => setAuthed(sessionStorage.getItem('shir_auth') === '1')
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const handleLogout = () => {
    sessionStorage.removeItem('shir_auth')
    setAuthed(false)
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public couple intake form */}
        <Route path="/" element={<CoupleForm />} />

        {/* Couple's personal work page (unique link) */}
        <Route path="/couple/:token" element={<CoupleWorkPage />} />

        {/* Shir's admin area */}
        <Route
          path="/admin"
          element={
            authed
              ? <AdminDashboard onLogout={handleLogout} />
              : <AdminLogin onLogin={() => setAuthed(true)} />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
