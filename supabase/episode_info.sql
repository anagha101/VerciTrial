-- Public read for episode intro on the timelapse landing page.
-- Run in Supabase SQL Editor after creating the tables.

alter table public.current_episode enable row level security;
alter table public.episode_info enable row level security;

drop policy if exists "Public read current_episode" on public.current_episode;
create policy "Public read current_episode"
  on public.current_episode for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read episode_info" on public.episode_info;
create policy "Public read episode_info"
  on public.episode_info for select
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';
