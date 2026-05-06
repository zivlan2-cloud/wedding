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
    const feeNum = parseFloat(f.fee) || 0
    const feeStr = feeNum ? `${feeNum.toLocaleString()} ₪` : '________'
    const remainStr = feeNum ? `${(feeNum - 2000).toLocaleString()} ₪` : '________'
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
  body { font-family: 'Heebo', Arial, sans-serif; font-size: 10.5pt; color: #111; direction: rtl; background: white; }
  .page { width: 210mm; min-height: 297mm; padding: 16mm 22mm; margin: 0 auto; }
  @media print {
    .page { page-break-after: always; margin: 0; width: 100%; }
    .page:last-child { page-break-after: avoid; }
    .no-print { display: none !important; }
  }
  h1 { font-size: 14pt; font-weight: 700; text-align: center; margin-bottom: 4px; }
  hr { border: none; border-top: 1px solid #888; margin: 8px 0; }
  .intro { font-size: 10pt; margin: 10px 0 6px; line-height: 1.7; }
  .party-block { margin: 6px 0 6px 0; line-height: 2; font-size: 10pt; }
  .party-block .party-label { font-weight: 700; display: inline-block; min-width: 52px; }
  .between { font-size: 10pt; margin: 8px 0; font-weight: 600; }
  ol { padding-right: 22px; margin: 10px 0; }
  ol li { margin-bottom: 7px; line-height: 1.75; font-size: 10pt; text-align: justify; }
  ol li ol { margin-top: 5px; }
  .sig-area { display: flex; justify-content: space-between; margin-top: 30px; gap: 40px; }
  .sig-box { flex: 1; text-align: center; position: relative; padding-top: 50px; font-size: 9.5pt; color: #333; }
  .sig-line { border-top: 1px solid #555; margin-bottom: 6px; }
  .sig-img { position: absolute; top: 4px; left: 50%; transform: translateX(-50%); height: 42px; width: auto; }
  .appendix-title { font-size: 13pt; font-weight: 700; text-align: center; margin-bottom: 6px; }
  .appendix-section { font-weight: 700; margin: 12px 0 4px; font-size: 10.5pt; }
  ul.app-list { padding-right: 20px; margin: 4px 0 10px; }
  ul.app-list li { margin-bottom: 6px; line-height: 1.7; font-size: 10pt; }
  ul.app-list li ul { margin-top: 4px; }
  .final-sig { display: flex; justify-content: space-between; margin-top: 28px; gap: 30px; }
  .final-sig-box { flex: 1; text-align: center; }
  .final-sig-line { border-top: 1px solid #555; margin-bottom: 5px; }
  .final-sig-name { font-size: 9.5pt; color: #333; }
  .final-sig-role { font-size: 9pt; color: #666; }
  .yalla { text-align: center; font-size: 11pt; font-weight: 700; margin: 22px 0 10px; }
  .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #2a1f1f; color: white; padding: 10px 24px; display: flex; align-items: center; justify-content: space-between; z-index: 999; font-family: 'Heebo', Arial, sans-serif; font-size: 13px; }
  .print-btn { padding: 8px 20px; background: #c9a07a; color: white; border: none; border-radius: 30px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .page-wrap { margin-top: 50px; }
</style>
</head>
<body>
<div class="print-bar no-print">
  <span>חוזה — ${f.partner1_name} ו${f.partner2_name} &nbsp;|&nbsp; לחצי "הדפס" ובחרי "שמור כ-PDF"</span>
  <button class="print-btn" onclick="window.print()">🖨️ הדפס / שמור כ-PDF</button>
</div>
<div class="page-wrap">

<!-- דף 1 — החוזה -->
<div class="page">
  <h1>הסכם למתן שירותי הפקה</h1>
  <p class="intro">שנערך ונחתם ביום ${f.sign_day} בחודש ${f.sign_month} ${f.sign_year}</p>
  <p class="between">בין</p>

  <div class="party-block">
    <span class="party-label"></span>שיר מילוא לנגלייב<br/>
    <span class="party-label"></span>ת.ז 301429577<br/>
    <span class="party-label"></span>מרחוב ___ ב קיבוץ דפנה<br/>
    <span class="party-label"></span>(להלן: ה"מנהלת האירוע")
  </div>

  <p class="between">מצד אחד; לבין</p>

  <div class="party-block">
    <span class="party-label"></span>${f.partner1_name} ו${f.partner2_name}<br/>
    <span class="party-label"></span>ת.ז ${f.partner1_id || '________________'} ו${f.partner2_id || '________________'} (בהתאמה)<br/>
    <span class="party-label"></span>מרחוב ${f.address_street || '________'} ב${f.address_city || '________'}<br/>
    <span class="party-label"></span>(להלן ביחד ולחוד: ה"מזמינים")
  </div>

  <p class="between">מצד שני;</p>
  <hr/>
  <p class="between">הוסכם והותנה בין הצדדים כדלקמן:</p>

  <ol>
    <li>הסכם זה מטרתו להסדיר את גבולות אחריותה של מנהלת האירוע במסגרת התחייבותה למתן שירותי ניהול, תיאום, בקרה, ופיקוח על פעילותם של הגורמים המעורבים (להלן: ה"שירותים") באירוע מסוג חתונה, בתאריך <strong>${eventDateStr}</strong> (להלן: ה"אירוע") ב – <strong>${f.venue || '______________________________'}</strong> (להלן: ה"מתחם" או ה"שטח").</li>
    <li>בגין השירותים ישלמו המזמינים למנהלת האירוע <strong>${feeStr}</strong> (להלן: "התמורה"). התמורה תשולם למנהלת האירוע באמצעות העברה בנקאית (ראה פירוט בנספח א׳, סעיף: תשלום).</li>
    <li>ביום האירוע תהא מנהלת האירוע אחראית לעמוד בקשר עם נותני השירותים, הקבלנים והספקים שנבחרו על ידי המזמינים לרבות שירותי הקייטרינג, מוזיקה, צלמים, עיצוב, חשמל, ציוד ואחרים (להלן: "ספקים באירוע"). יובהר כי כלל הספקים באירוע נבחרו על ידי המזמינים ולמזמינים לא תהיה כל טענה ו/או דרישה ו/או תביעה כלפי מנהלת האירוע בעניין טיב עבודת הספקים באירוע.</li>
    <li>המזמינים אחראים לדאוג, על חשבונם, לביטוח אשר יכסה, באופן סביר, כל נזק לרכוש ו/או לגוף שיגרם למי ממוזמני האירוע, ו/או למנהלת האירוע ו/או למי מהצוות שאיתה ו/או למי מהספקים באירוע ו/או לעובדיהם, בקשר לאירוע ובמהלכו.</li>
    <li>המזמינים לוקחים בזאת אחריות מלאה על הקרקע בה יתקיים האירוע וככל שהאירוע יתקיים במתחם סגור, גם על מתחם האירוע. המזמינים פוטרים בזאת את מנהלת האירוע מכל אחריות בנוגע לתקינות השטח ו/או המתחם וקיום אישורים, היתרים או רישיונות שיכול ונדרשים לקיום האירוע.</li>
    <li>יובהר כי במידה ובשטח האירוע תימצא בריכה, מנהלת האירוע אינה אחראית על כל נזק בגוף ו/או ברכוש שיגרם בגין שימוש בבריכה והמזמינים הינם האחראים הבלעדיים לעמידה בדרישות החוק בהקשר זה.</li>
    <li>הצדדים מסכימים כי מנהלת האירוע לא תהיה אחראית לשום נזק גוף ו/או רכוש ו/או אובדן ו/או הפסד העלולים להיגרם לספקים ו/או לעובדיהם ו/או למי מטעמם ו/או למי מהמשתתפים באירוע ו/או לצד שלישי כלשהו כתוצאה ממעשה או מחדל של המזמינים ו/או קבלנים ו/או קבלני משנה ועובדיהם הנוטלים חלק בעריכת האירוע.</li>
    <li>המזמינים פוטרים בזאת את המנהלת האירוע ומי מטעמה מכל אחריות לגבי נזקים כאמור ומתחייבים לשפות את הנ"ל על כל סכום שיחויבו לשלם עקב נזקים כאמור לרבות הוצאות ושכ"ט עו"ד.</li>
    <li>המזמינים יהיו האחראים לבטיחות כל הציוד ו/או המתקנים המשמשים לצורך האירוע לרבות אם מדובר במתקני קבע או מתקנים ארעיים.</li>
    <li>יובהר כי לא יתקיימו בין המזמינים למנהלת האירוע יחסי עובד מעביד וכן לא יתקיימו יחסי עובד מעביד בין המנהלת האירוע לבין קבלנים ועובדי קבלן אחרים באירוע.</li>
    <li>במקרה והמזמינים יבטלו את הזמנת האירוע מכל סיבה שהיא לאחר החתימה על הסכם זה, יחויבו המזמינים בתמורה בגין מתן שירותים טרום האירוע ויידרשו להעבירה במלואה תוך 7 ימים ממתן ההודעה על ביטול ההסכם.</li>
    <li>בנוסף לאמור בסעיף 11, במקרה והמזמינים יבטלו את הזמנת האירוע, פרט לסיבת כח עליון, ישלמו המזמינים למנהלת האירוע פיצוי מוסכם כדלהלן:
      <ol type="1" style="list-style-type: decimal;">
        <li>ביטול עד 30 יום לפני מועד האירוע — לא יחויב בתשלום פיצוי.</li>
        <li>ביטול 29 ימים או פחות אך לא פחות מ-8 ימים לפני — 50% מהתמורה בגין האירוע עצמו.</li>
        <li>ביטול ביום האירוע — מלוא התמורה.</li>
        <li>הודעת ביטול תיחשב רק הודעה שנמסרה בכתב ואושרה קבלה.</li>
        <li>במידה והאירוע יידחה עקב נסיבות חריגות (בידוד/מצב ביטחוני/רפואי) תהיה אפשרות לדחייה לתאריך חלופי מוסכם.</li>
      </ol>
    </li>
  </ol>

  <p style="margin-top:14px; font-size:10pt;">ולראיה באנו אנו על ידי החתום:</p>

  <div class="sig-area">
    <div class="sig-box">
      <img class="sig-img" src="${sigUrl}" alt="חתימת שיר" onerror="this.style.display='none'"/>
      <div class="sig-line"></div>
      <div>מנהלת האירוע</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div>${f.partner1_name} ו- ${f.partner2_name}</div>
      <div>המזמינים</div>
    </div>
  </div>
</div>

<!-- דף 2 — נספח א' -->
<div class="page">
  <div class="appendix-title">נספח א׳</div>
  <div class="appendix-title" style="font-size:11pt; font-weight:600; margin-bottom:10px;">פירוט עבודת מנהלת התהליך</div>
  <hr/>

  <p style="font-size:10pt; margin-bottom:8px;">(לאחר חתימה על הסכם זה):</p>

  <ul class="app-list">
    <li>פגישה ראשונית שלנו, פנים מול פנים, בשטח החתונה העתידית. נדמיין את האירוע ונתכנן סקיצה ראשונית.</li>
    <li>מעבר על חוזים שסופקו על ידי הספקים האופציונאליים והחזרת הערות.</li>
    <li>זמינות טלפונית מלאה לכל שאלה ועניין — וכמובן תמיכה נפשית ברגעים מאתגרים.</li>
    <li>פגישת ספקים (עד חודש לפני האירוע). פגישה של הספקים שלוקחים חלק באירוע, בשטח האירוע.</li>
    <li>שיחת העברת מקל: העברת מידע מסודרת — חוזים מפורטים, שעות הגעה, מספרי טלפון, דגשים לוגיסטיים ועיצוביים.</li>
    <li><strong>ניהול האירוע:</strong>
      <ul>
        <li>הגעה לשטח עם הגעת הספק הראשון, אך לא מעל 6 שעות לפני תחילת האירוע.</li>
        <li>פריסה ומיקום הספקים בשטח האירוע.</li>
        <li>פתרון בעיות, בל"תמים ומשברים.</li>
        <li>ניהול עובדי הפקה.</li>
        <li>וידוא כי הזוג מקבל ארוחה ויושב לאכול לפני תחילת האירוע.</li>
        <li>ניהול ותכלול כלל הספקים וההתרחשות לאורך כל האירוע.</li>
        <li>כספת: ריקון הכספת יתבצע על ידי איש קשר מטעם הזוג שיקבע מראש.</li>
        <li>תשלום לספקים: חלוקת מעטפות התשלום לספקים בסיום האירוע תתבצע על ידי שיר (מעטפות סגורות בלבד).</li>
        <li>פירוקים: קיפול השטח ווידוא השארתו נקי לפני שחרור כל ספק.</li>
      </ul>
    </li>
  </ul>

  <hr/>

  <div class="appendix-section">תשלום (הבהרה לסעיף 2 בחוזה):</div>
  <ul class="app-list">
    <li><strong>הפקה וניהול אירוע:</strong>
      <ul>
        <li>מקדמה על סך <strong>2,000 ₪</strong> על מנת לשריין את תאריך האירוע.</li>
        <li>שאר הסכום — <strong>${remainStr}</strong> — ישולם עד לשלושה ימים לאחר האירוע.</li>
        <li>התשלומים יבוצעו בהעברה בנקאית לחשבון: <strong>153749, סניף 462 (טבריה)</strong> עבור: שיר מילוא.</li>
        <li>אין צורך בתשלום מע"מ. (המחיר לא כולל את עובדי ההפקה).</li>
      </ul>
    </li>
    <li><strong>עובדי הפקה:</strong>
      <ul>
        <li>ההחלטה על כמות העובדים תעשה לאחר פגישת הספקים.</li>
        <li>עלות כל עובד: <strong>700 ₪</strong> — התשלום יתבצע בסיום האירוע במזומן, ישירות על ידי הזוג.</li>
      </ul>
    </li>
  </ul>

  <div class="yalla">יאללה, שנצא לדרך? 🎉</div>

  <div class="final-sig">
    <div class="final-sig-box">
      <div class="final-sig-line"></div>
      <div class="final-sig-name">שיר מילוא לנגלייב</div>
      <div class="final-sig-role">מנהלת האירוע</div>
    </div>
    <div class="final-sig-box">
      <div class="final-sig-line"></div>
      <div class="final-sig-name">${f.partner1_name} ו- ${f.partner2_name}</div>
      <div class="final-sig-role">המזמינים</div>
    </div>
  </div>
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
