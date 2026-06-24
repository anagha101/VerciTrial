import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_PHONE = Deno.env.get('ADMIN_PHONE_NUMBER') ?? '+12242503854'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { signup_id } = await req.json()
    if (!signup_id) {
      return new Response(JSON.stringify({ error: 'signup_id required' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: row, error } = await supabase
      .rpc('get_pending_signup_for_admin', { p_id: signup_id })
      .maybeSingle()

    if (error || !row) {
      return new Response(JSON.stringify({ error: error?.message ?? 'not found' }), { status: 404 })
    }

    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const token = Deno.env.get('TWILIO_AUTH_TOKEN')
    const from = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!sid || !token || !from) {
      console.warn('Twilio not configured — skipping SMS')
      return new Response(JSON.stringify({ ok: true, skipped: true }))
    }

    const body = [
      'New Sunset RSVP (reply YES or NO)',
      `ID: ${row.id}`,
      `Name: ${row.full_name}`,
      `Email: ${row.email}`,
      `Phone: ${row.phone ?? '—'}`,
      `Heard: ${row.heard_about ?? '—'}`,
      `Contact via: ${row.primary_contact}`,
      `Code: ${row.code}`,
    ].join('\n')

    const params = new URLSearchParams({ To: ADMIN_PHONE, From: from, Body: body })
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${sid}:${token}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      },
    )

    if (!twilioRes.ok) {
      const errText = await twilioRes.text()
      console.error(errText)
      return new Response(JSON.stringify({ error: 'Twilio failed' }), { status: 502 })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
