-- =============================================================================
-- Phase 1: brands, people, each person's role per brand, app logins, Leave Mode,
-- and the audit trail (who changed what, and when).
--
-- Access rules live here in the database (Row Level Security), so nothing in the
-- app can get around them. Apply with: npm run db:migrate
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------

-- What a login is allowed to do in the app.
--   admin            full access, manages logins and Leave Mode
--   updates_manager  adds and updates work items; cannot manage logins or brand settings
--   leave_cover      can edit a brand only while that brand's Leave Mode is on
--   viewer           read-only
create type public.app_role as enum ('admin', 'updates_manager', 'leave_cover', 'viewer');

create type public.process_tier as enum ('heavy', 'medium', 'low');

-- The kind of job someone does on a brand. Used later for the escalation ladder.
create type public.role_key as enum (
  'account_manager', 'account_deputy', 'digital_lead', 'channel_manager',
  'digital_executive', 'creative', 'kol_lead', 'partnerships',
  'quality_assurance', 'finance', 'buying', 'support', 'other'
);


-- -----------------------------------------------------------------------------
-- Tables
-- Every editable table carries created_at/by and updated_at/by, filled in
-- automatically by the stamp_row() trigger further down.
-- -----------------------------------------------------------------------------

create table public.people (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,              -- short fixed key, e.g. 'kesi'
  full_name      text not null,
  is_placeholder boolean not null default false,    -- unnamed roles, e.g. "Finance Manager"
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);

create table public.brands (
  id                         text primary key,      -- 'alieve', 'ducros', 'ccr'
  name                       text not null,
  colour                     text not null,         -- hex colour used in the UI
  tier                       public.process_tier not null,
  scope                      text not null,
  reporting                  text not null,
  in_execution_cycle         boolean not null default true,
  monthly_content_target_min int,
  monthly_content_target_max int,
  canva_calendar_url         text,
  leave_cover_person_id      uuid references public.people (id) on delete set null,
  leave_mode_on              boolean not null default false,
  sort_order                 int not null default 0,
  created_at                 timestamptz not null default now(),
  created_by                 uuid,
  updated_at                 timestamptz not null default now(),
  updated_by                 uuid
);

-- One row per job a person does on a brand. A person can hold several
-- (e.g. Samson on Alieve) and different jobs on different brands (e.g. Viche).
create table public.brand_roles (
  id               uuid primary key default gen_random_uuid(),
  brand_id         text not null references public.brands (id) on delete cascade,
  person_id        uuid not null references public.people (id) on delete cascade,
  role_key         public.role_key not null,
  title            text not null,
  responsibilities text,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
create index brand_roles_brand_idx on public.brand_roles (brand_id);
create index brand_roles_person_idx on public.brand_roles (person_id);

-- App logins. Supabase keeps the email and password in auth.users; this table
-- links a login to a team member and says what they may do.
create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  person_id  uuid unique references public.people (id) on delete set null,
  email      text not null,
  app_role   public.app_role not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- The audit trail. Written only by the write_audit() trigger; nobody can edit it.
create table public.audit_log (
  id              bigint generated always as identity primary key,
  table_name      text not null,
  row_id          text not null,
  action          text not null check (action in ('insert', 'update', 'delete')),
  changed_by      uuid,
  changed_by_name text not null,
  changed_at      timestamptz not null default now(),
  old_data        jsonb,
  new_data        jsonb
);
create index audit_log_row_idx on public.audit_log (table_name, row_id, changed_at desc);
create index audit_log_time_idx on public.audit_log (changed_at desc);


-- -----------------------------------------------------------------------------
-- Helper functions used by the access rules.
-- "security definer" lets them read profiles/brands regardless of the caller's
-- own access, which avoids rules that depend on themselves.
-- -----------------------------------------------------------------------------

create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.app_role from public.profiles p
  where p.user_id = auth.uid() and p.is_active
$$;

create function public.current_person_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.person_id from public.profiles p
  where p.user_id = auth.uid() and p.is_active
$$;

-- True for anyone with an active login (any role).
create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_app_role() is not null
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

-- Can the current login change work on this brand?
-- Admin and Updates Manager: always. Leave cover: only their brand, only while
-- its Leave Mode is on. Viewer: never.
create function public.can_edit_brand(p_brand_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case public.current_app_role()
    when 'admin' then true
    when 'updates_manager' then true
    when 'leave_cover' then exists (
      select 1 from public.brands b
      where b.id = p_brand_id
        and b.leave_mode_on
        and b.leave_cover_person_id = public.current_person_id()
    )
    else false
  end
$$;

-- The name shown in "last updated by" and the history.
create function public.current_user_name() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select coalesce(pe.full_name, pr.email)
       from public.profiles pr
       left join public.people pe on pe.id = pr.person_id
      where pr.user_id = auth.uid()),
    'System'
  )
$$;


-- -----------------------------------------------------------------------------
-- Triggers: automatic stamps, audit trail and safety checks
-- -----------------------------------------------------------------------------

-- Fills in created_at/by and updated_at/by. Callers cannot fake these.
create function public.stamp_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end
$$;

-- Records every insert, update and delete in audit_log, with who did it.
create function public.write_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  -- Skip saves that changed nothing but the timestamps.
  if tg_op = 'UPDATE'
     and (v_old - 'updated_at' - 'updated_by') = (v_new - 'updated_at' - 'updated_by') then
    return null;
  end if;

  insert into public.audit_log (table_name, row_id, action, changed_by, changed_by_name, old_data, new_data)
  values (tg_table_name, coalesce(v_row ->> 'id', v_row ->> 'user_id'), lower(tg_op),
          auth.uid(), public.current_user_name(), v_old, v_new);
  return null;
end
$$;

-- Brand settings and Leave Mode are Admin-only. Others with edit access to a
-- brand may only change its Canva calendar link.
-- (auth.uid() is null for setup scripts run directly on the database.)
create function public.guard_brand_settings() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_ignored text[] := array['canva_calendar_url', 'created_at', 'created_by', 'updated_at', 'updated_by'];
begin
  if auth.uid() is not null and not public.is_admin()
     and (to_jsonb(new) - v_ignored) <> (to_jsonb(old) - v_ignored) then
    raise exception 'Only the Admin can change brand settings or Leave Mode.';
  end if;
  return new;
end
$$;

-- Never allow the last active Admin to be removed or demoted (avoids lock-out).
create function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.app_role = 'admin' and old.is_active
     and (tg_op = 'DELETE' or new.app_role <> 'admin' or not new.is_active)
     and not exists (
       select 1 from public.profiles
       where app_role = 'admin' and is_active and user_id <> old.user_id
     ) then
    raise exception 'There must always be at least one active Admin.';
  end if;
  return coalesce(new, old);
end
$$;


-- -----------------------------------------------------------------------------
-- Starting data: brands and team (from the Team 1 Brand Assignments document).
-- Loaded before the audit triggers are attached, so the history starts clean.
-- -----------------------------------------------------------------------------

insert into public.people (slug, full_name, is_placeholder) values
  ('tolu',            'Tolu',            false),
  ('kesi',            'Kesi',            false),
  ('viche',           'Viche',           false),
  ('joy-ella',        'Joy Ella',        false),
  ('joshua',          'Joshua',          false),
  ('ope',             'Ope',             false),
  ('samson',          'Samson',          false),
  ('chisom',          'Chisom',          false),
  ('ebun',            'Ebun',            false),
  ('favour',          'Favour',          false),
  ('finance-manager', 'Finance Manager', true),
  ('buying-team',     'Buying team',     true);

insert into public.brands
  (id, name, colour, tier, scope, reporting, in_execution_cycle,
   monthly_content_target_min, monthly_content_target_max, sort_order)
values
  ('alieve', 'Alieve', '#3B6FD4', 'heavy',
   'Digital + traditional (TV/Radio). No OOH.',
   'Weekly + monthly reports', true, 8, 10, 1),
  ('ducros', 'Ducros', '#3F9142', 'medium',
   'Digital only. No TV/Radio.',
   'Bi-weekly + monthly reports', true, 8, 10, 2),
  ('ccr', 'CCR', '#7B4FA6', 'low',
   'Capital City Race. Partnership-led; not yet in the monthly execution cycle.',
   'As agreed per partnership', false, null, null, 3);

-- Leave cover: Kesi for Alieve, Chisom for Ducros and CCR.
update public.brands b set leave_cover_person_id = p.id
from public.people p
where (b.id = 'alieve' and p.slug = 'kesi')
   or (b.id in ('ducros', 'ccr') and p.slug = 'chisom');

insert into public.brand_roles (brand_id, person_id, role_key, title, responsibilities, sort_order)
select v.brand_id, p.id, v.role_key::public.role_key, v.title, v.responsibilities, v.sort_order
from (values
  -- Alieve
  ('alieve', 'tolu',            'account_manager',   'Account Manager',
     'Overall accountability for the brand.', 1),
  ('alieve', 'kesi',            'digital_lead',      'Digital Lead',
     'Monitors ad account setup, reports and campaigns. Client communication line. Reviews the content calendar in the Account Manager''s place during leave.', 2),
  ('alieve', 'viche',           'channel_manager',   'Channel Manager (Meta, Google)',
     'Copies and content calendar; captions and upload; content scheduling; ads live and monitoring.', 3),
  ('alieve', 'joy-ella',        'channel_manager',   'Channel Manager (TikTok)',
     'Content scheduling; ads live and monitoring; presentations and reporting support.', 4),
  ('alieve', 'joshua',          'creative',          'Creative Executive',
     'Asset and creative production.', 5),
  ('alieve', 'ope',             'creative',          'Creative Executive',
     'Asset and creative production.', 6),
  ('alieve', 'samson',          'kol_lead',          'KOL Lead',
     'Influencer and KOL (Key Opinion Leader) relationship management.', 7),
  ('alieve', 'samson',          'other',             'TGI Digital Lead',
     'TGI digital lead and client communication line.', 8),
  ('alieve', 'finance-manager', 'finance',           'Finance Manager',
     'Raises funds for ad spend with the Digital Lead.', 9),
  ('alieve', 'buying-team',     'buying',            'Buying team',
     'Vendor setup and media buying.', 10),
  -- Ducros
  ('ducros', 'tolu',            'account_manager',   'Account Manager',
     'Overall accountability for the brand.', 1),
  ('ducros', 'chisom',          'account_deputy',    'Account Deputy',
     'Leave-cover stand-in for the Account Manager.', 2),
  ('ducros', 'viche',           'digital_lead',      'Digital Lead & Channel Manager (Google)',
     'Ad account setup; asset and creative production; ads live and monitoring; communication with the production team.', 3),
  ('ducros', 'ebun',            'channel_manager',   'Channel Manager (Meta)',
     'Copies and content calendar; asset and creative production; captions and direct posting; scheduling; ads live and monitoring.', 4),
  ('ducros', 'joy-ella',        'channel_manager',   'Channel Manager (TikTok)',
     'Scheduling; ads live and monitoring; presentations support.', 5),
  ('ducros', 'favour',          'quality_assurance', 'Campaign Quality Assurance',
     'Keeps channel managers on track with brand integrity.', 6),
  ('ducros', 'finance-manager', 'finance',           'Finance Manager',
     'Raises funds for ad spend with the Digital Lead.', 7),
  -- CCR
  ('ccr',    'tolu',            'account_manager',   'Account Manager',
     'Overall accountability for the brand.', 1),
  ('ccr',    'chisom',          'account_deputy',    'Account Deputy',
     'Leave-cover stand-in for the Account Manager.', 2),
  ('ccr',    'viche',           'digital_executive', 'Digital Executive',
     'Digital channel management for the partnership engagement.', 3),
  ('ccr',    'ebun',            'partnerships',      'Partnerships Executive',
     'Partnership coordination and deliverables.', 4),
  ('ccr',    'joy-ella',        'support',           'Support',
     'Support on the partnership.', 5)
) as v (brand_id, slug, role_key, title, responsibilities, sort_order)
join public.people p on p.slug = v.slug;


-- -----------------------------------------------------------------------------
-- Attach triggers
-- -----------------------------------------------------------------------------

create trigger stamp_row before insert or update on public.people
  for each row execute function public.stamp_row();
create trigger stamp_row before insert or update on public.brands
  for each row execute function public.stamp_row();
create trigger stamp_row before insert or update on public.brand_roles
  for each row execute function public.stamp_row();
create trigger stamp_row before insert or update on public.profiles
  for each row execute function public.stamp_row();

create trigger write_audit after insert or update or delete on public.people
  for each row execute function public.write_audit();
create trigger write_audit after insert or update or delete on public.brands
  for each row execute function public.write_audit();
create trigger write_audit after insert or update or delete on public.brand_roles
  for each row execute function public.write_audit();
create trigger write_audit after insert or update or delete on public.profiles
  for each row execute function public.write_audit();

create trigger guard_brand_settings before update on public.brands
  for each row execute function public.guard_brand_settings();
create trigger guard_last_admin before update or delete on public.profiles
  for each row execute function public.guard_last_admin();


-- -----------------------------------------------------------------------------
-- Access rules (Row Level Security)
-- -----------------------------------------------------------------------------

alter table public.people      enable row level security;
alter table public.brands      enable row level security;
alter table public.brand_roles enable row level security;
alter table public.profiles    enable row level security;
alter table public.audit_log   enable row level security;

-- Anyone with an active login can read brands, the team and the history.
create policy "members read people"      on public.people      for select to authenticated using (public.is_member());
create policy "members read brands"      on public.brands      for select to authenticated using (public.is_member());
create policy "members read brand roles" on public.brand_roles for select to authenticated using (public.is_member());
create policy "members read history"     on public.audit_log   for select to authenticated using (public.is_member());

-- The team list is managed by the Admin.
create policy "admin writes people" on public.people for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin writes brand roles" on public.brand_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Brands: only the Admin adds or deletes them. Anyone who can edit a brand may
-- save it, but guard_brand_settings() limits non-Admins to the Canva link.
create policy "admin adds brands" on public.brands for insert to authenticated
  with check (public.is_admin());
create policy "admin deletes brands" on public.brands for delete to authenticated
  using (public.is_admin());
create policy "editors update brands" on public.brands for update to authenticated
  using (public.can_edit_brand(id)) with check (public.can_edit_brand(id));

-- Logins: you can see your own; the Admin sees and manages all.
create policy "read own or admin reads all logins" on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "admin manages logins" on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Table permissions. Logged-out visitors (anon) get nothing at all.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.people, public.brands, public.brand_roles, public.profiles
  to authenticated, service_role;
grant select on public.audit_log to authenticated, service_role;
revoke all on public.people, public.brands, public.brand_roles, public.profiles, public.audit_log from anon;
