import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADDRESS = '605 Hart St.'

function parseTwilioForm(body: string) {
  return Object.fromEntries(new URLSearchParams(body))
}

async function sendSms(to: string, body: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_PHONE_NUMBER')
  if (!sid || !token || !from) return

  const params = new URLSearchParams({ To: to, From: from, Body: body })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${sid}:${token}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
}

async function sendEmail(to: string, subject: string, body: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RSVP_FROM_EMAIL')
  if (!key || !from) return

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text: body }),
  })
}

Deno.serve(async (req) => {
  try {
    const form = parseTwilioForm(await req.text())
    const fromPhone = form.From ?? ''
    const body = (form.Body ?? '').trim().toUpperCase()
    const adminPhone = Deno.env.get('ADMIN_PHONE_NUMBER') ?? '+12242503854'

    if (fromPhone !== adminPhone) {
      return new Response('<Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    const approve = body === 'YES' || body.startsWith('YES ')
    const reject = body === 'NO' || body.startsWith('NO ')
    if (!approve && !reject) {
      await sendSms(adminPhone, 'Reply YES or NO to approve the latest RSVP.')
      return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: pending } = await supabase
      .from('signup')
      .select('id')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!pending?.id) {
      await sendSms(adminPhone, 'No pending RSVP found.')
      return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } })
    }

    const { data: rows } = await supabase.rpc('approve_signup_by_id', {
      p_id: pending.id,
      p_approve: approve,
    })

    const row = Array.isArray(rows) ? rows[0] : rows
    if (!row || !approve) {
      await sendSms(adminPhone, reject ? 'RSVP rejected.' : 'Could not approve.')
      return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } })
    }

    const ep = row.last_rsvp
    let title = 'Sunday Sunset Sessions'
    let subtitle = ''
    let time = ''

    if (ep != null) {
      const { data: epInfo } = await supabase
        .from('episode_info')
        .select('title, subtitle, time')
        .eq('id', ep)
        .maybeSingle()
      if (epInfo) {
        title = epInfo.title ?? title
        subtitle = epInfo.subtitle ?? ''
        time = epInfo.time ?? ''
      }
    }

    const epLabel = subtitle ? `${title}, ${subtitle}` : title
    const guestMsg = `You're RSVPed - see you for ${epLabel} on ${time} at ${ADDRESS}. Your unique RSVP code for future episodes is ${row.code}`

    if (row.primary_contact === 'phone' && row.phone) {
      await sendSms(row.phone, guestMsg)
    } else if (row.email) {
      await sendEmail(row.email, "You're RSVPed — Sunday Sunset Sessions", guestMsg)
    }

    await sendSms(adminPhone, `Approved ${row.full_name} (${row.code}).`)

    return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } })
  } catch (e) {
    console.error(e)
    return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } })
  }
})
