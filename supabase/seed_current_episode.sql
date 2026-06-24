-- Point the site at episode 2 (loads episode_info where id = 2).
-- Run in Supabase → SQL Editor.

delete from public.current_episode;

insert into public.current_episode (episode_number)
values (2);
