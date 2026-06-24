-- Sample episode intro for id 2 (shown when current_episode.episode_number = 2).
-- Run in Supabase → SQL Editor after seed_current_episode.sql.

delete from public.episode_info
where id = 2;

insert into public.episode_info (
  id,
  title,
  subtitle,
  description,
  time
)
values (
  2,
  'Sunday Sunset Sessions',
  'Episode 2 — Hot Verci Summer',
  'Join us for an evening on the roof as the sun goes down. We will share stories, music, and whatever you are carrying into this summer. RSVP below for the address and to let us know you are coming.',
  'Sunday, July 6 · 6:00 PM ET'
);
