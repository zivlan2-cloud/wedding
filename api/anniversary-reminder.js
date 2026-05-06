// Vercel Serverless Function — runs daily via cron
// Checks for weddings tomorrow and anniversary milestones (7 days / 1 day before)
// Sends email to shir6873@gmail.com via Resend

const SHIR_EMAIL = 'shir6873@gmail.com'
const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

function getAnniversaryAlerts(couples) {
  const alerts = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const c of couples) {
    if (!c.event_date || c.event_date === '2099-01-01') continue
    const wedding = new Date(c.event_date)
    const name = c.couple_name || `${c.partner1_name} ו${c.partner2_name}`

    const daysToWedding = Math.ceil((wedding.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // Day before wedding
    if (daysToWedding === 1) {
      alerts.push(`🎊 <strong>מחר החתונה של ${name}!</strong> בהצלחה!`)
    }
    if (daysToWedding === 0) {
      alerts.push(`💍 <strong>היום החתונה של ${name}!</strong> מזל טוב!`)
    }

    // Anniversary milestones for past weddings
    if (wedding < today) {
      const thisYearAnniv = new Date(today.getFullYear(), wedding.getMonth(), wedding.getDate())
      const daysToAnniv = Math.ceil((thisYearAnniv.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const years = thisYearAnniv.getFullYear() - wedding.getFullYear()

      if (daysToAnniv === 7) {
        alerts.push(`📸 <strong>עוד שבוע — שנה ${years} לחתונת ${name}</strong><br>זמן לפוסט אינסטגרם! ✨`)
      }
      if (daysToAnniv === 1) {
        alerts.push(`📸 <strong>מחר שנה ${years} לחתונת ${name}</strong><br>זמן לפוסט אינסטגרם! 🎉`)
      }
      if (daysToAnniv === 0) {
        alerts.push(`🎂 <strong>היום שנה ${years} לחתונת ${name}!</strong> מזל טוב! 💜`)
      }
    }
  }
  return alerts
}

export default async function handler(req, res) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Fetch all couples from Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/couples?select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    )
    const couples = await response.json()

    const alerts = getAnniversaryAlerts(couples)

    if (alerts.length === 0) {
      return res.status(200).json({ sent: false, reason: 'no alerts today' })
    }

    // Build email HTML
    const alertsHtml = alerts.map(a => `
      <div style="background:#f8f4ff;border-right:4px solid #6c3fa0;border-radius:10px;padding:14px 18px;margin-bottom:12px;font-family:Georgia,serif;font-size:16px;line-height:1.6;direction:rtl;text-align:right;">
        ${a}
      </div>
    `).join('')

    const html = `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;direction:rtl;text-align:right;">
        <div style="background:linear-gradient(135deg,#3a1f6e,#6c3fa0);padding:28px 32px;border-radius:16px 16px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;font-weight:700;">✦ שיר · תזכורות היום</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">${new Date().toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
        </div>
        <div style="background:white;padding:24px 32px;border-radius:0 0 16px 16px;border:1px solid #e8e0f0;border-top:none;">
          ${alertsHtml}
          <p style="color:#aaa;font-size:12px;margin-top:20px;">נשלח אוטומטית ממערכת ניהול החתונות של שיר</p>
        </div>
      </div>
    `

    // Send via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'שיר מפיקה <reminders@resend.dev>',
        to: SHIR_EMAIL,
        subject: `✦ תזכורת: ${alerts.length} עדכון${alerts.length > 1 ? 'ים' : ''} להיום`,
        html,
      }),
    })

    const emailData = await emailRes.json()
    return res.status(200).json({ sent: true, alerts: alerts.length, resend: emailData })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
