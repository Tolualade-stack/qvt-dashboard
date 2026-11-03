-- =============================================================================
-- Phase 2a: workspaces, the role catalogue, and assignment history.
--
-- PRIME can serve more than one company. Each company is a WORKSPACE; brands
-- (worlds) and team members belong to one. QVT Media is the first workspace.
-- During the pilot every active login can see every workspace; separating
-- logins per workspace comes when a second company joins.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Workspaces
-- -----------------------------------------------------------------------------

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- short fixed key, e.g. 'qvt'
  name        text not null,
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

insert into public.workspaces (slug, name, description, sort_order)
values ('qvt', 'QVT Media', 'Founding pilot partner.', 1);

alter table public.brands add column workspace_id uuid references public.workspaces (id) on delete restrict;
alter table public.people add column workspace_id uuid references public.workspaces (id) on delete restrict;
update public.brands set workspace_id = (select id from public.workspaces where slug = 'qvt');
update public.people set workspace_id = (select id from public.workspaces where slug = 'qvt');
alter table public.brands alter column workspace_id set not null;
alter table public.people alter column workspace_id set not null;
create index brands_workspace_idx on public.brands (workspace_id);
create index people_workspace_idx on public.people (workspace_id);

-- The brands' full names, as they appear on their worlds.
update public.brands set name = 'Ducros Spices' where id = 'ducros';
update public.brands set name = 'Alieve Pain Relief' where id = 'alieve';


-- -----------------------------------------------------------------------------
-- Role catalogue: the standard roles a workspace uses, editable by the Admin.
-- role_key says what kind of role it is, which drives the escalation ladder.
-- -----------------------------------------------------------------------------

create table public.role_catalogue (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null,
  description  text,
  role_key     public.role_key not null default 'other',
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  unique (workspace_id, name)
);

insert into public.role_catalogue (workspace_id, name, description, role_key, sort_order)
select w.id, v.name, v.description, v.role_key::public.role_key, v.sort_order
from public.workspaces w,
(values
  ('Account Manager',            'Overall accountability for the brand.',                          'account_manager',   1),
  ('Account Deputy',             'Stands in for the Account Manager during leave.',                'account_deputy',    2),
  ('Digital Lead',               'Leads digital: ad accounts, reports, campaign monitoring.',      'digital_lead',      3),
  ('Channel Manager',            'Runs channels: scheduling, posting, ads live and monitoring.',   'channel_manager',   4),
  ('Digital Executive',          'Copies, content calendar, channel management.',                  'digital_executive', 5),
  ('Creative Executive',         'Produces assets and creatives.',                                 'creative',          6),
  ('KOL Lead',                   'Manages influencer and KOL relationships.',                      'kol_lead',          7),
  ('Partnerships Executive',     'Coordinates partnerships and their deliverables.',               'partnerships',      8),
  ('Campaign Quality Assurance', 'Keeps channel managers on track with brand integrity.',          'quality_assurance', 9),
  ('Media Planner',              'Plans spots, sources rates, builds channel plans.',              'other',            10),
  ('Buying team',                'Negotiates vendor rates, executes spots, verifies locations.',   'buying',           11),
  ('Finance Manager',            'Raises invoices and funds ad spend.',                            'finance',          12),
  ('PR Lead',                    'Leads press and public relations work.',                         'other',            13),
  ('Activation Lead',            'Leads experiential activations and events.',                     'other',            14),
  ('TGI Digital Lead',           'TGI digital lead and client communication line.',                'other',            15),
  ('Support',                    'Supports the team where needed.',                                'support',          16)
) as v (name, description, role_key, sort_order)
where w.slug = 'qvt';


-- -----------------------------------------------------------------------------
-- Assignments (brand_roles) now point at the catalogue and keep their history:
-- moving someone off a brand sets ended_at instead of deleting the row.
-- `title` stays as the display label, e.g. "Channel Manager (Meta, Google)".
-- -----------------------------------------------------------------------------

alter table public.brand_roles add column role_id uuid references public.role_catalogue (id) on delete restrict;
alter table public.brand_roles add column started_at date not null default current_date;
alter table public.brand_roles add column ended_at timestamptz;

update public.brand_roles br set role_id = rc.id
from public.role_catalogue rc
where rc.role_key = br.role_key
  and (br.role_key <> 'other' or rc.name = br.title);

create index brand_roles_active_idx on public.brand_roles (brand_id) where ended_at is null;


-- -----------------------------------------------------------------------------
-- Triggers and access rules for the new tables (same pattern as Phase 1).
-- -----------------------------------------------------------------------------

create trigger stamp_row before insert or update on public.workspaces
  for each row execute function public.stamp_row();
create trigger stamp_row before insert or update on public.role_catalogue
  for each row execute function public.stamp_row();
create trigger write_audit after insert or update or delete on public.workspaces
  for each row execute function public.write_audit();
create trigger write_audit after insert or update or delete on public.role_catalogue
  for each row execute function public.write_audit();

alter table public.workspaces     enable row level security;
alter table public.role_catalogue enable row level security;

create policy "members read workspaces" on public.workspaces for select to authenticated using (public.is_member());
create policy "admin writes workspaces" on public.workspaces for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "members read role catalogue" on public.role_catalogue for select to authenticated using (public.is_member());
create policy "admin writes role catalogue" on public.role_catalogue for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.workspaces, public.role_catalogue to authenticated, service_role;
revoke all on public.workspaces, public.role_catalogue from anon;
