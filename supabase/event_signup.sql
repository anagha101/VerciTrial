-- Hot Verci Summer — RSVP storage + safe reads/updates for the anon web client.
--
-- HOW TO RUN (first time)
-- 1. Open https://supabase.com/dashboard → your project.
-- 2. Left sidebar: SQL Editor → New query.
-- 3. Copy this entire file, paste, click Run (no errors expected).
-- 4. Reload your Vite app; the backdrop should load (empty list until someone RSVPs).

create table if not exists public.signup (
  id uuid primary key default gen_random_uuid(),
  edit_code text not null,
  full_name text not null,
  email text not null,
  phone text,
  symbolic_item text not null,
  tenure_response text,
  favorite_snack text,
  image_object_path text,
  aura_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signup_edit_code_len check (char_length(edit_code) = 5),
  constraint signup_edit_code_digits check (edit_code ~ '^[0-9]{5}$')
);

alter table public.signup add column if not exists image_object_path text;
alter table public.signup add column if not exists aura_count bigint not null default 0;

-- If aura_count was added manually without NOT NULL / default:
update public.signup set aura_count = 0 where aura_count is null;
alter table public.signup alter column aura_count set default 0;
alter table public.signup alter column aura_count set not null;

-- Existing projects: allow NULL for optional fields (safe if already nullable).
alter table public.signup alter column phone drop not null;
alter table public.signup alter column tenure_response drop not null;
alter table public.signup alter column favorite_snack drop not null;

create unique index if not exists signup_edit_code_key on public.signup (edit_code);

-- One RSVP per email; one per phone number (digits compared, same as UI min 7 digits).
create unique index if not exists signup_email_normalized_key
  on public.signup (lower(btrim(email)));

create unique index if not exists signup_phone_digits_key
  on public.signup (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'))
  where phone is not null
    and btrim(phone) <> ''
    and length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) >= 7;

alter table public.signup enable row level security;

-- Direct inserts from the browser (anon key).
drop policy if exists "signup_anon_insert" on public.signup;
create policy "signup_anon_insert"
  on public.signup
  for insert
  to anon
  with check (true);

-- No direct select/update for anon — use SECURITY DEFINER functions below.

grant usage on schema public to anon;
grant insert on table public.signup to anon;

-- Public backdrop: names, items, optional public image path (no emails/phones).
drop function if exists public.list_signup_backdrop ();

create function public.list_signup_backdrop ()
returns table (
  id uuid,
  full_name text,
  symbolic_item text,
  image_object_path text,
  aura_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.full_name, s.symbolic_item, s.image_object_path, coalesce(s.aura_count, 0)::bigint as aura_count
  from public.signup s;
$$;

-- Load one RSVP for edit flow (full row; still only callable with a known code).
drop function if exists public.get_signup_by_code (text);

create function public.get_signup_by_code (p_edit_code text)
returns table (
  id uuid,
  edit_code text,
  full_name text,
  email text,
  phone text,
  symbolic_item text,
  tenure_response text,
  favorite_snack text,
  image_object_path text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    s.edit_code,
    s.full_name,
    s.email,
    s.phone,
    s.symbolic_item,
    s.tenure_response,
    s.favorite_snack,
    s.image_object_path
  from public.signup s
  where s.edit_code = trim(p_edit_code)
    and char_length(trim(p_edit_code)) = 5;
$$;

-- Update without granting blanket UPDATE on the table.
drop function if exists public.update_signup_by_code (text, text, text, text, text, text, text);
drop function if exists public.update_signup_by_code (text, text, text, text, text, text, text, text);

create function public.update_signup_by_code (
  p_edit_code text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_symbolic_item text,
  p_tenure_response text,
  p_favorite_snack text,
  p_image_object_path text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.signup
  set
    full_name = p_full_name,
    email = p_email,
    phone = nullif(btrim(p_phone), ''),
    symbolic_item = p_symbolic_item,
    tenure_response = nullif(btrim(p_tenure_response), ''),
    favorite_snack = nullif(btrim(p_favorite_snack), ''),
    image_object_path = nullif(btrim(p_image_object_path), ''),
    updated_at = now()
  where edit_code = trim(p_edit_code)
    and char_length(trim(p_edit_code)) = 5;

  return found;
end;
$$;

-- True if another row already uses this email or phone (exclude current edit code when saving edits).
drop function if exists public.check_signup_contact_available (text, text, text);

create function public.check_signup_contact_available (
  p_email text,
  p_phone text,
  p_exclude_edit_code text default null
)
returns table (
  email_taken boolean,
  phone_taken boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1
      from public.signup s
      where lower(btrim(s.email)) = lower(btrim(coalesce(p_email, '')))
        and (
          p_exclude_edit_code is null
          or trim(s.edit_code) is distinct from trim(p_exclude_edit_code)
        )
    ) as email_taken,
    exists (
      select 1
      from public.signup s
      where p_phone is not null
        and btrim(p_phone) <> ''
        and length(regexp_replace(btrim(p_phone), '[^0-9]', '', 'g')) >= 7
        and regexp_replace(coalesce(s.phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(btrim(p_phone), '[^0-9]', '', 'g')
        and length(regexp_replace(coalesce(s.phone, ''), '[^0-9]', '', 'g')) >= 1
        and (
          p_exclude_edit_code is null
          or trim(s.edit_code) is distinct from trim(p_exclude_edit_code)
        )
    ) as phone_taken;
$$;

-- Remove RSVP row by edit code (no blanket DELETE grant to anon).
drop function if exists public.delete_signup_by_code (text);

create function public.delete_signup_by_code (p_edit_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.signup
  where edit_code = trim(p_edit_code)
    and char_length(trim(p_edit_code)) = 5;

  return found;
end;
$$;

-- Public: increment aura counter (each click = +1 row count; UI shows ×10).
drop function if exists public.bump_signup_aura (uuid);

create function public.bump_signup_aura (p_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v bigint;
begin
  update public.signup
  set
    aura_count = coalesce(aura_count, 0) + 1,
    updated_at = now()
  where id = p_id
  returning aura_count into v;

  return coalesce(v, 0);
end;
$$;

grant execute on function public.list_signup_backdrop () to anon;
grant execute on function public.get_signup_by_code (text) to anon;
grant execute on function public.update_signup_by_code (
  text, text, text, text, text, text, text, text
) to anon;
grant execute on function public.check_signup_contact_available (text, text, text) to anon;
grant execute on function public.delete_signup_by_code (text) to anon;
grant execute on function public.bump_signup_aura (uuid) to anon;

-- ─── Storage: public RSVP photos (anon upload, public read URLs) ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rsvp-images',
  'rsvp-images',
  true,
  10485760, -- 10 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read rsvp-images" on storage.objects;
create policy "Public read rsvp-images"
  on storage.objects for select
  using (bucket_id = 'rsvp-images');

drop policy if exists "Anon insert rsvp-images" on storage.objects;
create policy "Anon insert rsvp-images"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'rsvp-images');

drop policy if exists "Anon update rsvp-images" on storage.objects;
create policy "Anon update rsvp-images"
  on storage.objects for update
  to anon
  using (bucket_id = 'rsvp-images')
  with check (bucket_id = 'rsvp-images');

drop policy if exists "Anon delete rsvp-images" on storage.objects;
create policy "Anon delete rsvp-images"
  on storage.objects for delete
  to anon
  using (bucket_id = 'rsvp-images');

-- Tell PostgREST to pick up new/updated functions (helps right after first deploy).
notify pgrst, 'reload schema';
