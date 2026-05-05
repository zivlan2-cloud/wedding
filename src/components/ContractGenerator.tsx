import React, { useState, useRef, useEffect } from 'react'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import { supabase } from '../lib/supabase'
import { Couple } from '../types'
import '../styles/ContractGenerator.css'

interface ContractGeneratorProps {
  couple: Couple
  onClose: () => void
}

const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

type Step = 'form' | 'preview' | 'done'

export const ContractGenerator: React.FC<ContractGeneratorProps> = ({ couple, onClose }) => {
  const today = new Date()
  const [step, setStep] = useState<Step>('form')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)

  const [fields, setFields] = useState({
    sign_day: String(today.getDate()),
    sign_month: MONTHS_HE[today.getMonth()],
    sign_year: String(today.getFullYear()),
    partner1_name: [couple.partner1_name, (couple as any).partner1_last_name].filter(Boolean).join(' '),
    partner2_name: [couple.partner2_name, (couple as any).partner2_last_name].filter(Boolean).join(' '),
    partner1_id: (couple as any).partner1_id || '',
    partner2_id: (couple as any).partner2_id || '',
    address_street: '',
    address_city: '',
    fee: '',
    event_date: couple.event_date && couple.event_date !== '2099-01-01' ? couple.event_date : '',
    venue: couple.venue_name || '',
  })

  const set = (k: string, v: string) => setFields(p => ({ ...p, [k]: v }))

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '________'
    const [y, m, d] = dateStr.split('-')
    return d && m && y ? `${d}.${m}.${y}` : dateStr
  }

  // ── Build PDF with pdf-lib ──
  const buildPdf = async (withShirSignature: boolean): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create()
    pdfDoc.registerFontkit((await import('@pdf-lib/fontkit')).default)

    // Try to embed Hebrew font via CDN, fallback to Helvetica
    let font: any
    try {
      const fontRes = await fetch('https://fonts.gstatic.com/s/rubik/v28/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-WYi1UA.woff2')
      // woff2 not supported by pdf-lib, use fallback
      throw new Error('use fallback')
    } catch {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    }

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Embed Shir's signature if requested
    let shirSigImage: any = null
    if (withShirSignature) {
      try {
        const res = await fetch('/images/signature_shir.png')
        const sigBytes = await res.arrayBuffer()
        shirSigImage = await pdfDoc.embedPng(new Uint8Array(sigBytes))
      } catch (e) {
        console.warn('Could not load signature image', e)
      }
    }

    const f = fields
    const feeStr = f.fee ? `₪${Number(f.fee).toLocaleString()}` : '________'
    const eventDateStr = formatDate(f.event_date)

    // Page 1
    const page1 = pdfDoc.addPage([595, 842]) // A4
    const { width, height } = page1.getSize()
    const margin = 60
    const rtlX = width - margin // start from right for RTL

    let y = height - 60

    const drawText = (text: string, x: number, yPos: number, size = 11, bold = false, color = rgb(0.1, 0.1, 0.1)) => {
      page1.drawText(text, { x, y: yPos, size, font: bold ? boldFont : font, color })
    }

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      page1.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) })
    }

    // Title
    drawText('הסכם למתן שירותי הפקה', margin + 160, y, 16, true)
    y -= 30
    drawLine(margin, y, width - margin, y)
    y -= 20

    // Date line
    drawText(`נחתם ביום ${f.sign_day} בחודש ${f.sign_month} ${f.sign_year}`, margin, y, 11)
    y -= 24

    // Party 1
    drawText('מנהלת האירוע:', margin, y, 11, true)
    drawText('שיר מילוא לנגלייב  ת.ז 301429577  קיבוץ דפנה', margin + 110, y, 10)
    y -= 20

    // Party 2
    drawText('המזמינים:', margin, y, 11, true)
    const p2line = `${f.partner1_name}  ת.ז ${f.partner1_id || '________'}   |   ${f.partner2_name}  ת.ז ${f.partner2_id || '________'}`
    drawText(p2line, margin + 80, y, 10)
    y -= 16
    drawText(`כתובת: ${f.address_street || '___________'}, ${f.address_city || '___________'}`, margin + 80, y, 10)
    y -= 24

    drawLine(margin, y, width - margin, y)
    y -= 18

    // Contract body — paragraphs
    const paragraphs = [
      `1. הסכם זה מסדיר את שירותי ניהול, תיאום, בקרה ופיקוח של מנהלת האירוע באירוע מסוג חתונה, בתאריך ${eventDateStr}, ב${f.venue || '_______________'}.`,
      `2. בגין השירותים ישלמו המזמינים למנהלת האירוע ${feeStr}. התמורה תשולם בהעברה בנקאית (ראה נספח א').`,
      `3. ביום האירוע תהא מנהלת האירוע אחראית לתיאום הספקים שנבחרו על ידי המזמינים. המזמינים מצהירים כי הספקים נבחרו על ידם ולא תהיה להם טענה כלפי מנהלת האירוע בנוגע לטיב עבודתם.`,
      `4. המזמינים אחראים לדאוג, על חשבונם, לביטוח אשר יכסה כל נזק לרכוש ו/או לגוף הקשור לאירוע.`,
      `5. המזמינים לוקחים אחריות מלאה על שטח האירוע, כולל אישורים, היתרים ורישיונות.`,
      `6. מנהלת האירוע לא תהיה אחראית לנזקים שיגרמו מכח עליון, ממעשי המזמינים, הספקים או צדדים שלישיים.`,
      `7. ביטול עד 30 יום לפני האירוע — ללא פיצוי. ביטול 29–8 ימים לפני — 50% מהתמורה. ביטול ביום האירוע — מלוא התמורה.`,
      `8. במקרה של דחייה עקב נסיבות חריגות (בידוד/מצב ביטחוני/רפואי), יתואם תאריך חלופי מוסכם.`,
    ]

    for (const para of paragraphs) {
      // Simple word wrap — split every ~85 chars
      const words = para.split(' ')
      let line = ''
      for (const word of words) {
        if ((line + word).length > 82) {
          drawText(line.trim(), margin, y, 10)
          y -= 15
          line = word + ' '
        } else {
          line += word + ' '
        }
      }
      if (line.trim()) { drawText(line.trim(), margin, y, 10); y -= 15 }
      y -= 6
    }

    y -= 20
    drawLine(margin, y, width - margin, y)
    y -= 30

    // Signatures
    drawText('חתימות:', margin, y, 12, true)
    y -= 30

    const sigY = y
    // Left sig box (Shir)
    drawLine(margin, sigY, margin + 180, sigY)
    drawText('שיר מילוא לנגלייב — מנהלת האירוע', margin, sigY - 14, 9)
    if (shirSigImage && withShirSignature) {
      const sigDims = shirSigImage.scale(0.12)
      page1.drawImage(shirSigImage, { x: margin + 10, y: sigY + 2, width: sigDims.width, height: sigDims.height })
    }

    // Right sig box (couple)
    const coupleX = margin + 280
    drawLine(coupleX, sigY, coupleX + 180, sigY)
    drawText(`${f.partner1_name} ו${f.partner2_name} — המזמינים`, coupleX, sigY - 14, 9)

    y -= 60

    // Page 2 — Appendix
    const page2 = pdfDoc.addPage([595, 842])
    let y2 = 842 - 60

    const draw2 = (text: string, x: number, yPos: number, size = 10, bold = false) => {
      page2.drawText(text, { x, y: yPos, size, font: bold ? boldFont : font, color: rgb(0.1, 0.1, 0.1) })
    }
    const line2 = (x1: number, y1: number, x2: number, y2b: number) => {
      page2.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2b }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) })
    }

    draw2("נספח א' — פירוט עבודת מנהלת התהליך", margin + 130, y2, 14, true)
    y2 -= 20
    line2(margin, y2, width - margin, y2)
    y2 -= 20

    const appendixItems = [
      'פגישה ראשונית פנים מול פנים בשטח החתונה — דמיון האירוע וסקיצה ראשונית.',
      'מעבר על חוזי ספקים אופציונאליים והחזרת הערות.',
      'זמינות טלפונית מלאה לכל שאלה — כולל תמיכה נפשית ברגעים מאתגרים.',
      'פגישת ספקים בשטח האירוע (עד חודש לפני האירוע).',
      'שיחת העברת מקל — חוזים מפורטים, שעות הגעה, טלפונים, דגשים לוגיסטיים.',
      'הגעה לשטח עם הספק הראשון (לא מעל 6 שעות לפני תחילת האירוע).',
      'פריסה ומיקום ספקים בשטח, פתרון בעיות ומשברים, ניהול עובדי הפקה.',
      'וידוא כי הזוג מקבל ארוחה ויושב לאכול לפני תחילת האירוע.',
      'ניהול ותכלול כלל הספקים וההתרחשות לאורך כל האירוע.',
    ]

    for (const item of appendixItems) {
      draw2(`• ${item}`, margin, y2, 10)
      y2 -= 18
    }

    y2 -= 10
    line2(margin, y2, width - margin, y2)
    y2 -= 20
    draw2('תשלום: העברה בנקאית. לוח תשלומים כמוסכם בין הצדדים.', margin, y2, 10, true)

    return await pdfDoc.save()
  }

  const handlePreview = async () => {
    setGenerating(true)
    try {
      const bytes = await buildPdf(false)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      setPdfUrl(URL.createObjectURL(blob))
      setPdfBytes(bytes)
      setStep('preview')
    } catch (e) {
      alert('שגיאה ביצירת התצוגה המקדימה: ' + e)
    } finally {
      setGenerating(false)
    }
  }

  const handleSignAndSave = async () => {
    setSaving(true)
    try {
      // Save ID numbers to couple record
      await supabase.from('couples').update({
        partner1_id: fields.partner1_id,
        partner2_id: fields.partner2_id,
        address: `${fields.address_street}, ${fields.address_city}`,
      }).eq('id', couple.id)

      // Build PDF with Shir's signature
      const signedBytes = await buildPdf(true)
      const blob = new Blob([signedBytes], { type: 'application/pdf' })

      // Upload to Supabase Storage
      const fileName = `contract_${couple.id}_${Date.now()}.pdf`
      const path = `${couple.id}/${fileName}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, blob, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)

      // Save to documents table as pending_couple_signature
      await supabase.from('documents').insert([{
        wedding_id: couple.id,
        file_name: `חוזה - ${couple.partner1_name} ו${couple.partner2_name}.pdf`,
        file_url: urlData.publicUrl,
        uploaded_by: 'shir',
        doc_zone: 'pending_signature',
      }])

      setPdfUrl(URL.createObjectURL(blob))
      setStep('done')
    } catch (e) {
      alert('שגיאה בשמירה: ' + e)
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = () => {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = `חוזה - ${fields.partner1_name} ו${fields.partner2_name}.pdf`
    a.click()
  }

  return (
    <div className="cg-overlay">
      <div className={`cg-modal ${step === 'preview' ? 'cg-modal-wide' : ''}`}>
        <div className="cg-header">
          <h2>
            {step === 'form' && '✍️ יצירת חוזה'}
            {step === 'preview' && '👁️ תצוגה מקדימה — בדקי שהכל תקין'}
            {step === 'done' && '✅ החוזה נשמר ומוכן לשליחה'}
          </h2>
          <button className="cg-close" onClick={onClose}>✕</button>
        </div>

        {/* ── STEP 1: Form ── */}
        {step === 'form' && (
          <>
            <div className="cg-body">
              <p className="cg-hint">מלאי את הפרטים — אחר כך תוצג תצוגה מקדימה של החוזה לפני שתחתמי.</p>

              <div className="cg-section-title">תאריך חתימה</div>
              <div className="cg-row">
                <div className="cg-group">
                  <label>יום</label>
                  <input className="cg-input" type="number" min="1" max="31" value={fields.sign_day} onChange={e => set('sign_day', e.target.value)} />
                </div>
                <div className="cg-group">
                  <label>חודש</label>
                  <select className="cg-input" value={fields.sign_month} onChange={e => set('sign_month', e.target.value)}>
                    {MONTHS_HE.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="cg-group">
                  <label>שנה</label>
                  <input className="cg-input" type="number" value={fields.sign_year} onChange={e => set('sign_year', e.target.value)} />
                </div>
              </div>

              <div className="cg-section-title">פרטי המזמינים</div>
              <div className="cg-row">
                <div className="cg-group">
                  <label>שם בן/בת זוג 1</label>
                  <input className="cg-input" value={fields.partner1_name} onChange={e => set('partner1_name', e.target.value)} />
                </div>
                <div className="cg-group">
                  <label>ת.ז.</label>
                  <input className="cg-input" placeholder="000000000" value={fields.partner1_id} onChange={e => set('partner1_id', e.target.value)} />
                </div>
              </div>
              <div className="cg-row">
                <div className="cg-group">
                  <label>שם בן/בת זוג 2</label>
                  <input className="cg-input" value={fields.partner2_name} onChange={e => set('partner2_name', e.target.value)} />
                </div>
                <div className="cg-group">
                  <label>ת.ז.</label>
                  <input className="cg-input" placeholder="000000000" value={fields.partner2_id} onChange={e => set('partner2_id', e.target.value)} />
                </div>
              </div>
              <div className="cg-row">
                <div className="cg-group">
                  <label>רחוב ומספר</label>
                  <input className="cg-input" placeholder="רחוב הורדים 5" value={fields.address_street} onChange={e => set('address_street', e.target.value)} />
                </div>
                <div className="cg-group">
                  <label>עיר</label>
                  <input className="cg-input" placeholder="תל אביב" value={fields.address_city} onChange={e => set('address_city', e.target.value)} />
                </div>
              </div>

              <div className="cg-section-title">פרטי האירוע</div>
              <div className="cg-row">
                <div className="cg-group">
                  <label>תאריך האירוע</label>
                  <input className="cg-input" type="date" value={fields.event_date} onChange={e => set('event_date', e.target.value)} />
                </div>
                <div className="cg-group">
                  <label>מקום האירוע</label>
                  <input className="cg-input" placeholder="יקב מייסטר" value={fields.venue} onChange={e => set('venue', e.target.value)} />
                </div>
              </div>

              <div className="cg-section-title">תמורה</div>
              <div className="cg-row">
                <div className="cg-group cg-group-wide">
                  <label>סכום שכר הטרחה (₪)</label>
                  <input className="cg-input" type="number" placeholder="0" value={fields.fee} onChange={e => set('fee', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="cg-footer">
              <button className="cg-back-btn" onClick={onClose}>ביטול</button>
              <button className="cg-print-btn" onClick={handlePreview} disabled={generating}>
                {generating ? 'יוצר תצוגה...' : '👁️ הצג תצוגה מקדימה ←'}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Preview ── */}
        {step === 'preview' && (
          <>
            <div className="cg-preview-body">
              {pdfUrl && (
                <div className="cg-pdf-container">
                  <object data={pdfUrl} type="application/pdf" className="cg-pdf-frame">
                    <div className="cg-pdf-fallback">
                      <p>הדפדפן שלך לא תומך בתצוגת PDF ישירה.</p>
                      <a href={pdfUrl} target="_blank" rel="noreferrer" className="cg-download-btn">
                        📄 פתח PDF בלשונית חדשה
                      </a>
                    </div>
                  </object>
                </div>
              )}
            </div>
            <div className="cg-footer">
              <button className="cg-back-btn" onClick={() => setStep('form')}>← חזרה לעריכה</button>
              <button className="cg-download-btn" onClick={handleDownload}>⬇️ הורד PDF</button>
              <button className="cg-print-btn" onClick={handleSignAndSave} disabled={saving}>
                {saving ? 'חותמת ושומרת...' : '✍️ הוסיפי חתימה ושלחי לזוג'}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: Done ── */}
        {step === 'done' && (
          <>
            <div className="cg-body cg-done-body">
              <div className="cg-done-icon">✅</div>
              <h3>החוזה נחתם ונשמר!</h3>
              <p>החוזה עם חתימת שיר נשמר בתיק הזוג תחת <strong>"חוזים ממתינים לחתימת הזוג"</strong>.</p>
              <p>כשתשלחי את הקישור לזוג — הם יוכלו לראות את החוזה, לחתום עליו דיגיטלית, והחוזה החתום יועלה אוטומטית לאזור "חוזים חתומים".</p>
              {pdfUrl && (
                <button className="cg-download-btn" onClick={handleDownload}>⬇️ הורד PDF לשמירה אישית</button>
              )}
            </div>
            <div className="cg-footer">
              <button className="cg-print-btn" onClick={onClose}>סגור</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
