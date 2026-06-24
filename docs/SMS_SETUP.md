# SMS & email RSVP approval setup

The app cannot send texts or emails from the browser alone. You need **Twilio** (SMS) and optionally **Resend** or **SendGrid** (email). Supabase **Edge Functions** handle the server side.

## Overview

1. Guest submits **New RSVP** → row saved as `approval_status = 'pending'`
2. Edge function `notify-rsvp` texts **you** at `+1 224-250-3854` with their details
3. You reply **YES** or **NO** to that Twilio number
4. Edge function `twilio-inbound` updates Supabase and texts/emails the guest if approved

## 1. Twilio (required for SMS)

1. Create a [Twilio](https://www.twilio.com) account
2. Buy a **US phone number** with SMS (~$1.15/mo + ~$0.0079/SMS)
3. You cannot send from a random number — it must be a Twilio number you own
4. Note these values:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER` (your Twilio number, e.g. `+15551234567`)
   - `ADMIN_PHONE_NUMBER` = `+12242503854`

## 2. Email (optional, for guests who chose email as primary contact)

Use [Resend](https://resend.com) or SendGrid:

- `RESEND_API_KEY`
- `RSVP_FROM_EMAIL` — must be a verified domain/sender in Resend (e.g. `rsvp@yourdomain.com`)

## 3. Deploy edge functions

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase secrets set \
  TWILIO_ACCOUNT_SID=... \
  TWILIO_AUTH_TOKEN=... \
  TWILIO_PHONE_NUMBER=+1... \
  ADMIN_PHONE_NUMBER=+12242503854 \
  RESEND_API_KEY=... \
  RSVP_FROM_EMAIL=rsvp@yourdomain.com

supabase functions deploy notify-rsvp
supabase functions deploy twilio-inbound
```

## 4. Twilio webhook

In Twilio Console → Phone number → Messaging:

- **A message comes in** webhook:  
  `https://YOUR_PROJECT_REF.supabase.co/functions/v1/twilio-inbound`

## 5. Run SQL

In Supabase SQL Editor, run in order:

1. `supabase/event_signup.sql`
2. `supabase/signup_sunset_sessions.sql`

## Admin SMS format

You receive:

```
New Sunset RSVP (reply YES or NO)
ID: <uuid>
Name: ...
Email: ...
Phone: ...
Heard: ...
Contact via: email|phone
Code: 1234
```

Reply **YES** or **NO** (case insensitive). The webhook matches the most recent pending RSVP for that reply thread.

## Guest confirmation message

On **YES**:

```
You're RSVPed - see you for [title], [subtitle] on [time] at 605 Hart St. Your unique RSVP code for future episodes is [code]
```

Sent via SMS if `primary_contact = phone`, otherwise email.

## Without Twilio (dev only)

RSVPs still save to Supabase. Manually set `approval_status = 'approved'` in the Table Editor for testing the profile / aura farm flow.

```sql
update public.signup set approval_status = 'approved' where code = '1234';
```
