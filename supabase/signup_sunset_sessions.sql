-- Sunday Sunset Sessions RSVP extensions.
-- Run in Supabase SQL Editor after event_signup.sql.

alter table public.signup add column if not exists code text;
alter table public.signup add column if not exists last_rsvp integer;
alter table public.signup add column if not exists heard_about text;
alter table public.signup add column if not exists primary_contact text;
alter table public.signup add column if not exists profile_message text;
alter table public.signup add column if not exists approval_status text not null default 'approved';

alter table public.signup alter column symbolic_item drop not null;

update public.signup set approval_status = 'approved' where approval_status is null;

create unique index if not exists signup_code_key on public.signup (code)
where code is not null;

alter table public.signup drop constraint if exists signup_code_digits;
alter table public.signup add constraint signup_code_digits
  check (code is null or code ~ '^[0-9]{4}$');

alter table public.signup drop constraint if exists signup_primary_contact_chk;
alter table public.signup add constraint signup_primary_contact_chk
  check (primary_contact is null or primary_contact in ('email', 'phone'));

alter table public.signup drop constraint if exists signup_approval_status_chk;
alter table public.signup add constraint signup_approval_status_chk
  check (approval_status in ('pending', 'approved', 'rejected'));

-- ─── Lookup by 4-digit code ───
drop function if exists public.get_signup_by_rsvp_code (text);

create function public.get_signup_by_rsvp_code (p_code text)
returns table (
  id uuid,
  code text,
  full_name text,
  email text,
  phone text,
  heard_about text,
  primary_contact text,
  profile_message text,
  image_object_path text,
  aura_count bigint,
  last_rsvp integer,
  approval_status text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    s.code,
    s.full_name,
    s.email,
    s.phone,
    s.heard_about,
    s.primary_contact,
    s.profile_message,
    s.image_object_path,
    coalesce(s.aura_count, 0)::bigint,
    s.last_rsvp,
    s.approval_status
  from public.signup s
  where s.code = trim(p_code)
    and char_length(trim(p_code)) = 4;
$$;

-- ─── Create new RSVP (pending approval) ───
drop function if exists public.create_sunset_signup (
  text, text, text, text, text, integer
);

create function public.create_sunset_signup (
  p_full_name text,
  p_email text,
  p_phone text,
  p_heard_about text,
  p_primary_contact text,
  p_last_rsvp integer
)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_id uuid;
  v_attempt int := 0;
begin
  if p_primary_contact not in ('email', 'phone') then
    raise exception 'primary_contact must be email or phone';
  end if;

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 24 then
      raise exception 'Could not allocate a unique RSVP code';
    end if;
    v_code := lpad((floor(random() * 10000))::int::text, 4, '0');
    begin
      insert into public.signup (
        edit_code,
        code,
        full_name,
        email,
        phone,
        heard_about,
        primary_contact,
        last_rsvp,
        approval_status,
        symbolic_item
      )
      values (
        v_code || '0',
        v_code,
        btrim(p_full_name),
        btrim(p_email),
        nullif(btrim(p_phone), ''),
        nullif(btrim(p_heard_about), ''),
        p_primary_contact,
        p_last_rsvp,
        'pending',
        null
      )
      returning signup.id into v_id;
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;

  return query select v_id, v_code;
end;
$$;

-- ─── Touch last_rsvp when returning guest enters code ───
drop function if exists public.touch_signup_last_rsvp (text, integer);

create function public.touch_signup_last_rsvp (p_code text, p_last_rsvp integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.signup
  set last_rsvp = p_last_rsvp, updated_at = now()
  where code = trim(p_code) and char_length(trim(p_code)) = 4;
  return found;
end;
$$;

-- ─── Poll approval status ───
drop function if exists public.get_signup_approval_status (text);

create function public.get_signup_approval_status (p_code text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select s.approval_status
  from public.signup s
  where s.code = trim(p_code) and char_length(trim(p_code)) = 4;
$$;

-- ─── Update profile (photo + message) ───
drop function if exists public.update_signup_profile_by_code (
  text, text, text
);

create function public.update_signup_profile_by_code (
  p_code text,
  p_profile_message text,
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
    profile_message = nullif(btrim(p_profile_message), ''),
    image_object_path = nullif(btrim(p_image_object_path), ''),
    updated_at = now()
  where code = trim(p_code) and char_length(trim(p_code)) = 4;
  return found;
end;
$$;

-- ─── Aura farm: approved guests for this episode ───
drop function if exists public.list_signup_aura_farm (integer);

create function public.list_signup_aura_farm (p_episode integer)
returns table (
  id uuid,
  full_name text,
  profile_message text,
  image_object_path text,
  aura_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    s.full_name,
    s.profile_message,
    s.image_object_path,
    coalesce(s.aura_count, 0)::bigint
  from public.signup s
  where s.last_rsvp = p_episode
    and s.approval_status = 'approved';
$$;

-- ─── Admin approval (called from Twilio webhook with service role) ───
drop function if exists public.approve_signup_by_id (uuid, boolean);

create function public.approve_signup_by_id (p_id uuid, p_approve boolean)
returns table (
  id uuid,
  code text,
  full_name text,
  email text,
  phone text,
  primary_contact text,
  last_rsvp integer,
  approval_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.signup
  set approval_status = case when p_approve then 'approved' else 'rejected' end,
      updated_at = now()
  where id = p_id and approval_status = 'pending';

  return query
  select
    s.id, s.code, s.full_name, s.email, s.phone,
    s.primary_contact, s.last_rsvp, s.approval_status
  from public.signup s
  where s.id = p_id;
end;
$$;

-- Pending RSVP for admin SMS (most recent)
drop function if exists public.get_pending_signup_for_admin (uuid);

create function public.get_pending_signup_for_admin (p_id uuid)
returns table (
  id uuid,
  code text,
  full_name text,
  email text,
  phone text,
  heard_about text,
  primary_contact text,
  last_rsvp integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id, s.code, s.full_name, s.email, s.phone,
    s.heard_about, s.primary_contact, s.last_rsvp
  from public.signup s
  where s.id = p_id;
$$;

grant execute on function public.get_signup_by_rsvp_code (text) to anon;
grant execute on function public.create_sunset_signup (
  text, text, text, text, text, integer
) to anon;
grant execute on function public.touch_signup_last_rsvp (text, integer) to anon;
grant execute on function public.get_signup_approval_status (text) to anon;
grant execute on function public.update_signup_profile_by_code (text, text, text) to anon;
grant execute on function public.list_signup_aura_farm (integer) to anon;

notify pgrst, 'reload schema';
