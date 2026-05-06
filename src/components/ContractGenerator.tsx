import React, { useState } from 'react'
import { Couple } from '../types'
import '../styles/ContractGenerator.css'

interface ContractGeneratorProps {
  couple: Couple
  onClose: () => void
}

const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

type Step = 'form' | 'preview'

export const ContractGenerator: React.FC<ContractGeneratorProps> = ({ couple, onClose }) => {
  const today = new Date()
  const [step, setStep] = useState<Step>('form')

  const [fields, setFields] = useState({
    sign_day: String(today.getDate()),
    sign_month: MONTHS_HE[today.getMonth()],
    sign_year: String(today.getFullYear()),
    partner1_name: [couple.partner1_name, (couple as any).partner1_last_name].filter(Boolean).join(' '),
    partner2_name: [couple.partner2_name, (couple as any).partner2_last_name].filter(Boolean).join(' '),
    partner1_id: (couple as any).partner1_id || '',
    partner2_id: (couple as any).partner2_id || '',
    address_street: (couple as any).address?.split(',')[0]?.trim() || '',
    address_city: (couple as any).address?.split(',')[1]?.trim() || '',
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

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=900,height=700')
    if (!printWin) { alert('אנא אפשרי חלונות קופצים עבור אתר זה'); return }

    const f = fields
    const feeStr = f.fee ? `₪${Number(f.fee).toLocaleString()}` : '________'
    const eventDateStr = formatDate(f.event_date)
    const sigUrl = `${window.location.origin}/images/signature_shir.png`

    const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<title>חוזה — ${f.partner1_name} ו${f.partner2_name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Heebo', Arial, sans-serif;
    font-size: 11pt;
    color: #111;
    direction: rtl;
    background: white;
    padding: 0;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 18mm 20mm 18mm 20mm;
    margin: 0 auto;
    page-break-after: always;
  }
  .page:last-child { page-break-after: avoid; }
  h1 {
    font-size: 17pt;
    font-weight: 700;
    text-align: center;
    margin-bottom: 6px;
    letter-spacing: 1px;
  }
  .subtitle {
    text-align: center;
    font-size: 10pt;
    color: #666;
    margin-bottom: 14px;
  }
  hr { border: none; border-top: 1px solid #bbb; margin: 10px 0; }
  .parties { margin: 12px 0; font-size: 10.5pt; line-height: 1.8; }
  .parties strong { font-weight: 700; }
  .section { margin: 14px 0 4px; font-size: 10pt; line-height: 1.85; }
  .section p { margin-bottom: 6px; text-align: justify; }
  .sig-area {
    display: flex;
    justify-content: space-between;
    margin-top: 36px;
    gap: 40px;
  }
  .sig-box {
    flex: 1;
    border-top: 1.5px solid #555;
    padding-top: 8px;
    font-size: 9.5pt;
    color: #444;
    text-align: center;
    min-height: 70px;
    position: relative;
  }
  .sig-img {
    position: absolute;
    top: -44px;
    right: 50%;
    transform: translateX(50%);
    height: 40px;
    width: auto;
  }
  .appendix-title {
    font-size: 14pt;
    font-weight: 700;
    text-align: center;
    margin-bottom: 8px;
  }
  .appendix-list { margin: 12px 0; padding-right: 18px; }
  .appendix-list li { margin-bottom: 8px; font-size: 10.5pt; line-height: 1.7; }
  .payment-note { margin-top: 16px; font-weight: 700; font-size: 10.5pt; }
  @media print {
    body { padding: 0; }
    .page { margin: 0; width: 100%; }
    .no-print { display: none !important; }
  }
  .print-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    background: #2a1f1f;
    color: white;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    z-index: 999;
    font-family: 'Heebo', Arial, sans-serif;
    font-size: 14px;
  }
  .print-bar span { opacity: 0.8; font-size: 13px; }
  .print-btn {
    padding: 9px 22px;
    background: #c9a07a;
    color: white;
    border: none;
    border-radius: 30px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: 'Heebo', Arial, sans-serif;
  }
  .print-btn:hover { background: #b08060; }
  .page-wrap { margin-top: 56px; }
</style>
</head>
<body>
<div class="print-bar no-print">
  <span>חוזה — ${f.partner1_name} ו${f.partner2_name} &nbsp;|&nbsp; לחצי הדפס ובחרי "שמור כ-PDF" כדי לשמור</span>
  <button class="print-btn" onclick="window.print()">🖨️ הדפס / שמור כ-PDF</button>
</div>

<div class="page-wrap">
<!-- דף 1 -->
<div class="page">
  <h1>הסכם למתן שירותי הפקה</h1>
  <div class="subtitle">נחתם ביום ${f.sign_day} בחודש ${f.sign_month} ${f.sign_year}</div>
  <hr/>

  <div class="parties">
    <strong>מנהלת האירוע:</strong> שיר מילוא לנגלייב &nbsp;|&nbsp; ת.ז 301429577 &nbsp;|&nbsp; קיבוץ דפנה<br/>
    <strong>המזמינים:</strong>
    ${f.partner1_name} &nbsp; ת.ז ${f.partner1_id || '________'} &nbsp;&nbsp;|&nbsp;&nbsp;
    ${f.partner2_name} &nbsp; ת.ז ${f.partner2_id || '________'}<br/>
    <strong>כתובת:</strong> ${f.address_street || '___________'}, ${f.address_city || '___________'}
  </div>

  <hr/>

  <div class="section">
    <p><strong>1.</strong> הסכם זה מסדיר את שירותי ניהול, תיאום, בקרה ופיקוח של מנהלת האירוע באירוע מסוג חתונה, בתאריך ${eventDateStr}, ב${f.venue || '_______________'}.</p>
    <p><strong>2.</strong> בגין השירותים ישלמו המזמינים למנהלת האירוע ${feeStr}. התמורה תשולם בהעברה בנקאית (ראה נספח א').</p>
    <p><strong>3.</strong> ביום האירוע תהא מנהלת האירוע אחראית לתיאום הספקים שנבחרו על ידי המזמינים. המזמינים מצהירים כי הספקים נבחרו על ידם ולא תהיה להם טענה כלפי מנהלת האירוע בנוגע לטיב עבודתם.</p>
    <p><strong>4.</strong> המזמינים אחראים לדאוג, על חשבונם, לביטוח אשר יכסה כל נזק לרכוש ו/או לגוף הקשור לאירוע.</p>
    <p><strong>5.</strong> המזמינים לוקחים אחריות מלאה על שטח האירוע, כולל אישורים, היתרים ורישיונות.</p>
    <p><strong>6.</strong> מנהלת האירוע לא תהיה אחראית לנזקים שיגרמו מכח עליון, ממעשי המזמינים, הספקים או צדדים שלישיים.</p>
    <p><strong>7.</strong> ביטול עד 30 יום לפני האירוע — ללא פיצוי. ביטול 29–8 ימים לפני — 50% מהתמורה. ביטול ביום האירוע — מלוא התמורה.</p>
    <p><strong>8.</strong> במקרה של דחייה עקב נסיבות חריגות (בידוד/מצב ביטחוני/רפואי), יתואם תאריך חלופי מוסכם.</p>
  </div>

  <hr/>

  <div class="sig-area">
    <div class="sig-box">
      <img class="sig-img" src="${sigUrl}" alt="חתימת שיר" onerror="this.style.display='none'"/>
      <div>שיר מילוא לנגלייב</div>
      <div>מנהלת האירוע</div>
    </div>
    <div class="sig-box">
      <div>${f.partner1_name} ו${f.partner2_name}</div>
      <div>המזמינים</div>
    </div>
  </div>
</div>

<!-- דף 2 -->
<div class="page">
  <div class="appendix-title">נספח א' — פירוט עבודת מנהלת התהליך</div>
  <hr/>
  <ul class="appendix-list">
    <li>פגישה ראשונית פנים מול פנים בשטח החתונה — דמיון האירוע וסקיצה ראשונית.</li>
    <li>מעבר על חוזי ספקים אופציונאליים והחזרת הערות.</li>
    <li>זמינות טלפונית מלאה לכל שאלה — כולל תמיכה נפשית ברגעים מאתגרים.</li>
    <li>פגישת ספקים בשטח האירוע (עד חודש לפני האירוע).</li>
    <li>שיחת העברת מקל — חוזים מפורטים, שעות הגעה, טלפונים, דגשים לוגיסטיים.</li>
    <li>הגעה לשטח עם הספק הראשון (לא מעל 6 שעות לפני תחילת האירוע).</li>
    <li>פריסה ומיקום ספקים בשטח, פתרון בעיות ומשברים, ניהול עובדי הפקה.</li>
    <li>וידוא כי הזוג מקבל ארוחה ויושב לאכול לפני תחילת האירוע.</li>
    <li>ניהול ותכלול כלל הספקים וההתרחשות לאורך כל האירוע.</li>
  </ul>
  <hr/>
  <div class="payment-note">תשלום: העברה בנקאית. לוח תשלומים כמוסכם בין הצדדים.</div>
</div>
</div>
</body>
</html>`

    printWin.document.write(html)
    printWin.document.close()
  }

  return (
    <div className="cg-overlay">
      <div className="cg-modal">
        <div className="cg-header">
          <h2>✍️ יצירת חוזה</h2>
          <button className="cg-close" onClick={onClose}>✕</button>
        </div>

        <div className="cg-body">
          <p className="cg-hint">מלאי את הפרטים — לאחר מכן ייפתח החוזה בחלון חדש עם חתימת שיר, ותוכלי לשמור אותו כ-PDF ולשלוח לזוג.</p>

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
          <button className="cg-print-btn" onClick={handlePrint}>
            🖨️ צור חוזה ופתח להדפסה
          </button>
        </div>
      </div>
    </div>
  )
}
