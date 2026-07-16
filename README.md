# Sunday Sunset Sessions

Landing page with the latest episode from a YouTube playlist, RSVP flow, and aura farm for each episode.

## Setup

1. Copy `.env.example` to `.env` and add your Supabase URL and anon key.
2. Set `VITE_YOUTUBE_PLAYLIST` to your episodes playlist (full URL or raw playlist ID). The playlist plays top-down in the embed, so keep the newest episode at the top.
3. At the bottom of `supabase/schema.sql`, edit the event details and shared `rsvp_code`.
4. In the Supabase SQL Editor, paste and run the entire `supabase/schema.sql` reset/rebuild script.
5. Upload the flyer for the current episode number (from `current_episode`): `photos/{n}/flyer.png`.
6. Share the RSVP code privately with invited guests. No SMS provider or Supabase Auth setup is required.
7. `npm install` then `npm run dev`

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run preview` — preview production build
