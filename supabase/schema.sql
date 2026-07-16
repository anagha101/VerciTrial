-- Sunday Sunset Sessions — FULL RESET + REBUILD
-- Paste this entire script into Supabase → SQL Editor and click Run.
-- Destroys all app tables/records. Storage buckets and existing photos remain.

-- ─── 1. Remove every prior app object ───
drop view if exists public.public_episode_attendees cascade;
drop function if exists public.bump_signup_aura(uuid) cascade;
drop function if exists public.verify_episode_rsvp(text, text) cascade;
drop function if exists public.save_episode_rsvp(text, text, text, text, text) cascade;

drop table if exists public.episode_attendance cascade;
drop table if exists public.signup cascade;
drop table if exists public.episode_private_info cascade;
drop table if exists public.episode_info cascade;
drop table if exists public.current_episode cascade;
drop table if exists public.event_signup cascade;
drop table if exists public.signup_sunset_sessions cascade;

-- ─── 2. Episodes ───
create table public.episode_info (
  id integer primary key,
  title text not null default '',
  subtitle text not null default '',
  description text not null default '',
  time text not null default ''
);

-- One-row pointer to the episode currently shown on the site.
create table public.current_episode (
  singleton boolean primary key default true check (singleton),
  episode_number integer not null references public.episode_info (id)
);

-- Never grant direct anonymous access to this table.
create table public.episode_private_info (
  episode_number integer primary key references public.episode_info (id) on delete cascade,
  rsvp_code text not null check (char_length(trim(rsvp_code)) between 1 and 12),
  address text not null default '',
  instructions text not null default ''
);

-- ─── 3. Reusable guest profiles + episode history ───
create table public.signup (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  full_name text not null,
  profile_message text,
  image_object_path text,
  aura_count bigint not null default 0 check (aura_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- An RSVP creates one row here. This replaces last_rsvp and preserves history.
create table public.episode_attendance (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references public.signup (id) on delete cascade,
  episode_number integer not null references public.episode_info (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (signup_id, episode_number)
);

create index episode_attendance_episode_idx
  on public.episode_attendance (episode_number);

-- ─── 4. RLS: block direct access to private records ───
alter table public.current_episode enable row level security;
alter table public.episode_info enable row level security;
alter table public.episode_private_info enable row level security;
alter table public.signup enable row level security;
alter table public.episode_attendance enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.current_episode to anon, authenticated;
grant select on public.episode_info to anon, authenticated;

create policy "Public read current episode"
  on public.current_episode for select to anon, authenticated using (true);

create policy "Public read episode info"
  on public.episode_info for select to anon, authenticated using (true);

-- No policies or direct grants are created for private info, signup, or
-- attendance. Anonymous access happens only through the narrow functions below.

-- ─── 5. Verify phone + shared episode code ───
-- Returns private details and the matching saved profile. The RSVP code itself
-- is never returned to the browser.
create function public.verify_episode_rsvp(phone_input text, code_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  episode_id integer;
  private_row public.episode_private_info%rowtype;
  profile_row public.signup%rowtype;
begin
  select episode_number into episode_id
  from public.current_episode
  limit 1;

  if episode_id is null then
    raise exception 'NO_CURRENT_EPISODE';
  end if;

  select * into private_row
  from public.episode_private_info
  where episode_number = episode_id;

  if not found then
    raise exception 'RSVP_NOT_CONFIGURED';
  end if;

  if upper(trim(private_row.rsvp_code)) <> upper(trim(code_input)) then
    raise exception 'INVALID_RSVP_CODE';
  end if;

  select * into profile_row
  from public.signup
  where phone = trim(phone_input);

  return jsonb_build_object(
    'episode_number', episode_id,
    'address', private_row.address,
    'instructions', private_row.instructions,
    'full_name', profile_row.full_name,
    'profile_message', profile_row.profile_message,
    'image_object_path', profile_row.image_object_path
  );
end;
$$;

-- Validates the code again, upserts the reusable profile, and records this
-- episode in the guest's attendance history.
create function public.save_episode_rsvp(
  phone_input text,
  code_input text,
  full_name_input text,
  profile_message_input text default null,
  image_object_path_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  episode_id integer;
  expected_code text;
  profile_id uuid;
begin
  select ce.episode_number, epi.rsvp_code
  into episode_id, expected_code
  from public.current_episode ce
  join public.episode_private_info epi on epi.episode_number = ce.episode_number
  limit 1;

  if episode_id is null then
    raise exception 'RSVP_NOT_CONFIGURED';
  end if;

  if upper(trim(expected_code)) <> upper(trim(code_input)) then
    raise exception 'INVALID_RSVP_CODE';
  end if;

  if nullif(trim(phone_input), '') is null then
    raise exception 'PHONE_REQUIRED';
  end if;

  if nullif(trim(full_name_input), '') is null then
    raise exception 'NAME_REQUIRED';
  end if;

  insert into public.signup (
    phone,
    full_name,
    profile_message,
    image_object_path
  )
  values (
    trim(phone_input),
    trim(full_name_input),
    nullif(trim(profile_message_input), ''),
    nullif(trim(image_object_path_input), '')
  )
  on conflict (phone) do update
  set
    full_name = excluded.full_name,
    profile_message = excluded.profile_message,
    image_object_path = coalesce(excluded.image_object_path, signup.image_object_path),
    updated_at = now()
  returning id into profile_id;

  insert into public.episode_attendance (signup_id, episode_number)
  values (profile_id, episode_id)
  on conflict (signup_id, episode_number) do nothing;

  return jsonb_build_object('signup_id', profile_id, 'episode_number', episode_id);
end;
$$;

revoke all on function public.verify_episode_rsvp(text, text) from public;
revoke all on function public.save_episode_rsvp(text, text, text, text, text) from public;
grant execute on function public.verify_episode_rsvp(text, text) to anon, authenticated;
grant execute on function public.save_episode_rsvp(text, text, text, text, text) to anon, authenticated;

-- ─── 6. Public Aura Farm: safe columns only ───
create view public.public_episode_attendees as
select
  a.episode_number,
  s.id,
  s.full_name,
  s.profile_message,
  s.image_object_path,
  s.aura_count
from public.episode_attendance a
join public.signup s on s.id = a.signup_id;

grant select on public.public_episode_attendees to anon, authenticated;

create function public.bump_signup_aura(signup_id_input uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  update public.signup
  set aura_count = aura_count + 1, updated_at = now()
  where id = signup_id_input
  returning aura_count;
$$;

revoke all on function public.bump_signup_aura(uuid) from public;
grant execute on function public.bump_signup_aura(uuid) to anon, authenticated;

-- ─── 7. Storage: preserve buckets and all existing files ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'rsvp-images',
    'rsvp-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  ),
  (
    'photos',
    'photos',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read rsvp-images" on storage.objects;
drop policy if exists "Anon insert rsvp-images" on storage.objects;
drop policy if exists "Anon update rsvp-images" on storage.objects;
drop policy if exists "Auth insert own rsvp-images" on storage.objects;
drop policy if exists "Auth update own rsvp-images" on storage.objects;
drop policy if exists "Public read photos" on storage.objects;

create policy "Public read rsvp-images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'rsvp-images');

-- Upload names are random UUIDs generated by the frontend. Existing files stay.
create policy "Anon insert rsvp-images"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'rsvp-images');

create policy "Public read photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'photos');

-- ─── 8. Seed the current event ───
-- Change the event text, private details, and shared RSVP code here.
insert into public.episode_info (id, title, subtitle, description, time)
values (
  2,
  'Sunday Sunset Sessions',
  'Episode 2',
  'Join us for an evening on the roof as the sun goes down. RSVP below to unlock the address and add yourself to the aura farm.',
  'Sunday, July 6 · 6:00 PM ET'
);

insert into public.current_episode (episode_number)
values (2);

insert into public.episode_private_info (
  episode_number,
  rsvp_code,
  address,
  instructions
)
values (
  2,
  'SUNSET',
  '123 Example St, Apt 4, New York, NY',
  'Buzz 4B and come up to the roof. Bring a layer for after sundown.'
);

notify pgrst, 'reload schema';
