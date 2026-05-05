import React, { useRef, useState, useEffect } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { supabase } from '../lib/supabase'
import '../styles/CoupleSignature.css'

interface CoupleSignatureProps {
  weddingId: string
  partnerName: string
  contractDoc: { id: string; file_name: string; file_url: string }
  onSigned: () => void
}

export const CoupleSignature: React.FC<CoupleSignatureProps> = ({
  weddingId, partnerName, contractDoc, onSigned
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPdf, setShowPdf] = useState(false)

  // Canvas drawing logic
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setDrawing(true)
    setHasSignature(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!drawing) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  const endDraw = () => setDrawing(false)

  const clearSignature = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const handleSign = async () => {
    if (!hasSignature) return
    setSaving(true)
    try {
      // Get signature as PNG
      const canvas = canvasRef.current!
      const sigDataUrl = canvas.toDataURL('image/png')
      const sigRes = await fetch(sigDataUrl)
      const sigArrBuf = await sigRes.arrayBuffer()
      const sigBytes = new Uint8Array(sigArrBuf)

      // Fetch the original PDF
      const pdfRes = await fetch(contractDoc.file_url)
      const pdfArrBuf = await pdfRes.arrayBuffer()
      const pdfDoc = await PDFDocument.load(pdfArrBuf)

      // Embed couple's signature
      const sigImage = await pdfDoc.embedPng(sigBytes)
      const sigDims = sigImage.scale(0.18)

      // Find page 1, add signature in couple's sig area
      const page = pdfDoc.getPage(0)
      page.drawImage(sigImage, {
        x: 290,   // right side (couple's signature position)
        y: 95,
        width: sigDims.width,
        height: sigDims.height,
      })

      // Add timestamp text
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const now = new Date()
      const dateStr = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`
      page.drawText(`נחתם: ${dateStr}`, { x: 290, y: 80, size: 8, font, color: rgb(0.4, 0.4, 0.4) })

      const signedBytes = await pdfDoc.save()
      const blob = new Blob([signedBytes], { type: 'application/pdf' })

      // Upload signed PDF
      const fileName = `signed_contract_${weddingId}_${Date.now()}.pdf`
      const path = `${weddingId}/${fileName}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, blob, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)

      // Save to documents as signed contract
      await supabase.from('documents').insert([{
        wedding_id: weddingId,
        file_name: contractDoc.file_name.replace('חוזה -', 'חוזה חתום -'),
        file_url: urlData.publicUrl,
        uploaded_by: 'couple',
        doc_zone: 'contracts',
      }])

      // Mark original as signed (update zone)
      await supabase.from('documents').update({ doc_zone: 'signed_archived' }).eq('id', contractDoc.id)

      onSigned()
    } catch (e) {
      alert('שגיאה בחתימה: ' + e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cs-wrap">
      <div className="cs-header">
        <h3>✍️ חתימה על החוזה</h3>
        <p>שיר הכינה לכם חוזה ממתין לחתימתכם. קראו אותו, ואז חתמו למטה.</p>
      </div>

      <div className="cs-actions-top">
        <button className="cs-view-btn" onClick={() => setShowPdf(!showPdf)}>
          {showPdf ? '▲ הסתר חוזה' : '👁️ קראו את החוזה לפני החתימה'}
        </button>
        <a href={contractDoc.file_url} target="_blank" rel="noreferrer" className="cs-download-btn">
          ⬇️ הורד PDF
        </a>
      </div>

      {showPdf && (
        <iframe
          src={contractDoc.file_url + '#toolbar=0'}
          className="cs-pdf-frame"
          title="חוזה לחתימה"
        />
      )}

      <div className="cs-signature-area">
        <label className="cs-sig-label">חתימת {partnerName}:</label>
        <div className="cs-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={360}
            height={120}
            className="cs-canvas"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          {!hasSignature && (
            <span className="cs-canvas-placeholder">חתמו כאן עם האצבע או העכבר</span>
          )}
        </div>
        {hasSignature && (
          <button className="cs-clear-btn" onClick={clearSignature}>נקה חתימה</button>
        )}
      </div>

      <button
        className="cs-sign-btn"
        onClick={handleSign}
        disabled={!hasSignature || saving}
      >
        {saving ? 'שומר חתימה...' : '✅ אשר חתימה ושלח'}
      </button>
    </div>
  )
}
