-- =============================================================================
-- Brand -> Campaign -> Work.
--
--   campaigns              what a campaign is and what it includes
--   campaign_team          its Update Managers (up to 3)
--   campaign_areas         who covers each area (content, ads, OOH...)
--   campaign_deliverables  non-digital work counted against a plan, e.g. 12 TV spots
--   work_issues            an issue raised on any piece of work (ads keep their own)
--
-- Existing content, ads, reports, assets and budget lines are not changed: they
-- get an empty campaign link, and stay editable as before until attached to one.
-- =============================================================================

create type public.campaign_status as enum ('live', 'ended');

alter table public.people add column email text;

create table public.campaigns (
  id                     uuid primary key default gen_random_uuid(),
  brand_id               text not null references public.brands (id) on delete cascade,
  name                   text not null check (length(trim(name)) > 1),
  objective              text,
  start_date             date,
  end_date               date,
  status                 public.campaign_status not null default 'live',
  kpis                   jsonb not null default '[]',   -- [{ "metric": "reach", "target": 1200000 }]
  marketing_types        text[] not null default '{}',
  channels               text[] not null default '{}',
  selections             jsonb not null default '{}',   -- { "tv": ["Spot (TVC)"], "billboards": [...] }
  quantities             jsonb not null default '{}',   -- { "tv": 12 }
  content_target_min     int,
  content_target_max     int,
  creative_assets_target int,
  track_assets           boolean not null default true,
  track_numbers          boolean not null default true,
  reporting              text,
  tier                   public.process_tier not null default 'medium',
  in_monthly_cycle       boolean not null default true,
  media_plan_url         text,
  media_plan_path        text,
  strategy_url           text,
  strategy_path          text,
  account_lead_person_id uuid references public.people (id) on delete set null,
  leave_cover_person_id  uuid references public.people (id) on delete set null,
  email_alerts           text[] not null default '{assigned,due_soon,overdue,replies,check_in}',
  launched_at            timestamptz not null default now(),
  is_archived            boolean not null default false,
  created_at             timestamptz not null default now(),
  created_by             uuid,
  updated_at             timestamptz not null default now(),
  updated_by             uuid,
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index campaigns_brand_idx on public.campaigns (brand_id) where not is_archived;

create table public.campaign_team (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  person_id   uuid not null references public.people (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (campaign_id, person_id)
);

-- A campaign has at most 3 Update Managers.
create function public.limit_campaign_team() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.campaign_team where campaign_id = new.campaign_id) >= 3 then
    raise exception 'A campaign can have up to 3 Update Managers.';
  end if;
  return new;
end
$$;
create trigger limit_campaign_team before insert on public.campaign_team
  for each row execute function public.limit_campaign_team();

create table public.campaign_areas (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  area        text not null,
  person_id   uuid not null references public.people (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (campaign_id, area)
);
create index campaign_areas_person_idx on public.campaign_areas (person_id);

create table public.campaign_deliverables (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  brand_id    text not null references public.brands (id) on delete cascade,
  area        text not null,
  group_id    text not null,           -- e.g. tv, billboards
  title       text not null,           -- e.g. TV spots
  detail      text,                    -- e.g. Digital billboard (LED), Static billboard
  unit        text not null default 'done',
  planned_qty int check (planned_qty is null or planned_qty >= 0),
  done_qty    int not null default 0 check (done_qty >= 0),
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  unique (campaign_id, group_id)
);
create index campaign_deliverables_brand_idx on public.campaign_deliverables (brand_id) where not is_archived;

create table public.work_issues (
  id          uuid primary key default gen_random_uuid(),
  brand_id    text not null references public.brands (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete cascade,
  item_type   text not null,           -- content, report, asset, deliverable, numbers
  item_id     text not null,
  title       text not null,
  note        text,
  raised_at   timestamptz not null default now(),
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create index work_issues_open_idx on public.work_issues (brand_id) where resolved_at is null;

-- The raised time can't be backdated.
create function public.track_work_issue() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.raised_at := now();
  else
    new.raised_at := old.raised_at;
  end if;
  return new;
end
$$;
create trigger track_work_issue before insert or update on public.work_issues
  for each row execute function public.track_work_issue();

-- Tracked work can belong to a campaign.
alter table public.content_items   add column campaign_id uuid references public.campaigns (id) on delete set null;
alter table public.ads             add column campaign_id uuid references public.campaigns (id) on delete set null;
alter table public.reports         add column campaign_id uuid references public.campaigns (id) on delete set null;
alter table public.creative_assets add column campaign_id uuid references public.campaigns (id) on delete set null;
alter table public.budget_lines    add column campaign_id uuid references public.campaigns (id) on delete set null;
create index content_items_campaign_idx   on public.content_items (campaign_id);
create index ads_campaign_idx             on public.ads (campaign_id);
create index reports_campaign_idx         on public.reports (campaign_id);
create index creative_assets_campaign_idx on public.creative_assets (campaign_id);
create index budget_lines_campaign_idx    on public.budget_lines (campaign_id);

do $$
declare t text;
begin
  foreach t in array array['campaigns', 'campaign_team', 'campaign_areas', 'campaign_deliverables', 'work_issues'] loop
    execute format('create trigger stamp_row before insert or update on public.%I for each row execute function public.stamp_row()', t);
    execute format('create trigger write_audit after insert or update or delete on public.%I for each row execute function public.write_audit()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end
$$;


-- -----------------------------------------------------------------------------
-- Who may do what
-- -----------------------------------------------------------------------------

-- Does the current login cover this area of this campaign? True for the Admin,
-- the campaign's Account Lead, whoever covers the area, and the brand's leave
-- cover while Leave Mode is on.
create function public.can_cover(p_campaign uuid, p_area text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or exists (
      select 1 from public.campaigns c
      join public.brands b on b.id = c.brand_id
      where c.id = p_campaign
        and (c.account_lead_person_id = public.current_person_id()
             or (b.leave_mode_on and b.leave_cover_person_id = public.current_person_id()))
    )
    or exists (
      select 1 from public.campaign_areas a
      where a.campaign_id = p_campaign and a.area = p_area and a.person_id = public.current_person_id()
    )
$$;

-- As before, plus: anyone leading or managing a live campaign on the brand.
create or replace function public.can_edit_brand(p_brand_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(case public.current_app_role()
    when 'admin' then true
    when 'updates_manager' then true
    when 'leave_cover' then exists (
      select 1 from public.brands b
      where b.id = p_brand_id
        and b.leave_mode_on
        and b.leave_cover_person_id = public.current_person_id()
    )
    else false
  end, false)
  or exists (
    select 1 from public.campaigns c
    where c.brand_id = p_brand_id and c.status = 'live' and not c.is_archived
      and (c.account_lead_person_id = public.current_person_id()
           or exists (select 1 from public.campaign_team t where t.campaign_id = c.id and t.person_id = public.current_person_id()))
  )
$$;

create policy "members read campaigns" on public.campaigns for select to authenticated using (public.is_member());
create policy "admin writes campaigns" on public.campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "members read campaign team" on public.campaign_team for select to authenticated using (public.is_member());
create policy "admin writes campaign team" on public.campaign_team for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "members read campaign areas" on public.campaign_areas for select to authenticated using (public.is_member());
create policy "admin writes campaign areas" on public.campaign_areas for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "members read deliverables" on public.campaign_deliverables for select to authenticated using (public.is_member());
create policy "admin adds deliverables" on public.campaign_deliverables for insert to authenticated with check (public.is_admin());
create policy "coverers update deliverables" on public.campaign_deliverables for update to authenticated
  using (public.can_cover(campaign_id, area)) with check (public.can_cover(campaign_id, area));
create policy "admin removes deliverables" on public.campaign_deliverables for delete to authenticated using (public.is_admin());

create policy "members read issues" on public.work_issues for select to authenticated using (public.is_member());
create policy "editors raise issues" on public.work_issues for insert to authenticated with check (public.can_edit_brand(brand_id));
create policy "editors resolve issues" on public.work_issues for update to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));
create policy "admin removes issues" on public.work_issues for delete to authenticated using (public.is_admin());

-- Work in a campaign can only be changed by whoever covers its area. Work with
-- no campaign keeps the old rule.
drop policy "editors add content" on public.content_items;
drop policy "editors update content" on public.content_items;
create policy "editors add content" on public.content_items for insert to authenticated
  with check (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'content')));
create policy "editors update content" on public.content_items for update to authenticated
  using (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'content')))
  with check (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'content')));

drop policy "editors add ads" on public.ads;
drop policy "editors update ads" on public.ads;
create policy "editors add ads" on public.ads for insert to authenticated
  with check (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'ads')));
create policy "editors update ads" on public.ads for update to authenticated
  using (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'ads')))
  with check (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'ads')));

drop policy "editors add reports" on public.reports;
drop policy "editors update reports" on public.reports;
create policy "editors add reports" on public.reports for insert to authenticated
  with check (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'reports')));
create policy "editors update reports" on public.reports for update to authenticated
  using (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'reports')))
  with check (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'reports')));

drop policy "editors add assets" on public.creative_assets;
drop policy "editors update assets" on public.creative_assets;
create policy "editors add assets" on public.creative_assets for insert to authenticated
  with check (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'assets')));
create policy "editors update assets" on public.creative_assets for update to authenticated
  using (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'assets')))
  with check (public.can_edit_brand(brand_id) and (campaign_id is null or public.can_cover(campaign_id, 'assets')));


-- -----------------------------------------------------------------------------
-- Launch: creates a campaign and all its checked work in one go, or nothing at
-- all if any part fails. Runs as the person launching, so every rule above and
-- the history still apply.
-- -----------------------------------------------------------------------------

create function public.launch_campaign(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_brand text := p ->> 'brand_id';
  v_sort int;
begin
  if not public.is_admin() then
    raise exception 'Only the Admin can launch a campaign.';
  end if;

  insert into public.campaigns (
    brand_id, name, objective, start_date, end_date, kpis, marketing_types, channels, selections, quantities,
    content_target_min, content_target_max, creative_assets_target, track_assets, track_numbers, reporting, tier, in_monthly_cycle,
    media_plan_url, media_plan_path, strategy_url, strategy_path, account_lead_person_id, leave_cover_person_id, email_alerts
  ) values (
    v_brand, p ->> 'name', p ->> 'objective', (p ->> 'start_date')::date, (p ->> 'end_date')::date,
    coalesce(p -> 'kpis', '[]'),
    array(select jsonb_array_elements_text(coalesce(p -> 'marketing_types', '[]'))),
    array(select jsonb_array_elements_text(coalesce(p -> 'channels', '[]'))),
    coalesce(p -> 'selections', '{}'), coalesce(p -> 'quantities', '{}'),
    (p ->> 'content_target_min')::int, (p ->> 'content_target_max')::int, (p ->> 'creative_assets_target')::int,
    coalesce((p ->> 'track_assets')::boolean, true), coalesce((p ->> 'track_numbers')::boolean, true),
    p ->> 'reporting', coalesce(p ->> 'tier', 'medium')::public.process_tier, coalesce((p ->> 'in_monthly_cycle')::boolean, true),
    p ->> 'media_plan_url', p ->> 'media_plan_path', p ->> 'strategy_url', p ->> 'strategy_path',
    (p ->> 'account_lead_person_id')::uuid, (p ->> 'leave_cover_person_id')::uuid,
    array(select jsonb_array_elements_text(coalesce(p -> 'email_alerts', '[]')))
  ) returning id into v_id;

  insert into public.campaign_team (campaign_id, person_id)
    select v_id, value::uuid from jsonb_array_elements_text(coalesce(p -> 'team', '[]'));

  insert into public.campaign_areas (campaign_id, area, person_id)
    select v_id, a ->> 'area', (a ->> 'person_id')::uuid from jsonb_array_elements(coalesce(p -> 'areas', '[]')) a;

  select coalesce(max(sort_order), 0) into v_sort from public.budget_lines where brand_id = v_brand;
  insert into public.budget_lines (brand_id, campaign_id, channel, format, planned_amount, currency, sort_order)
    select v_brand, v_id, l.v ->> 'channel', nullif(l.v ->> 'format', ''), (l.v ->> 'amount')::numeric,
           coalesce(l.v ->> 'currency', 'NGN')::public.currency, v_sort + l.n
    from jsonb_array_elements(coalesce(p -> 'budget_lines', '[]')) with ordinality as l(v, n);

  insert into public.ads (brand_id, campaign_id, name, channel, format, budget, currency)
    select v_brand, v_id, a ->> 'name', a ->> 'channel', nullif(a ->> 'format', ''), (a ->> 'budget')::numeric,
           coalesce(a ->> 'currency', 'NGN')::public.currency
    from jsonb_array_elements(coalesce(p -> 'ads', '[]')) a;

  insert into public.content_items (brand_id, campaign_id, title, planned_date, platforms)
    select v_brand, v_id, c ->> 'title', (c ->> 'date')::date,
           array(select jsonb_array_elements_text(coalesce(c -> 'platforms', '[]')))
    from jsonb_array_elements(coalesce(p -> 'content', '[]')) c;

  -- A regular report may already be scheduled for the brand: link it, don't repeat it.
  insert into public.reports (brand_id, campaign_id, kind, period_label, due_at)
    select v_brand, v_id, (r ->> 'kind')::public.report_kind, r ->> 'label', (r ->> 'due_at')::timestamptz
    from jsonb_array_elements(coalesce(p -> 'reports', '[]')) r
  on conflict (brand_id, kind, due_at) do update
    set campaign_id = excluded.campaign_id where public.reports.campaign_id is null;

  insert into public.campaign_deliverables (campaign_id, brand_id, area, group_id, title, detail, unit, planned_qty)
    select v_id, v_brand, d ->> 'area', d ->> 'group_id', d ->> 'title', d ->> 'detail', coalesce(d ->> 'unit', 'done'), (d ->> 'planned_qty')::int
    from jsonb_array_elements(coalesce(p -> 'deliverables', '[]')) d;

  -- Optionally bring in what this world is already tracking.
  if coalesce((p ->> 'attach_existing')::boolean, false) then
    update public.content_items   set campaign_id = v_id where brand_id = v_brand and campaign_id is null and not is_archived and status <> 'posted';
    update public.ads             set campaign_id = v_id where brand_id = v_brand and campaign_id is null and not is_archived and status <> 'ended';
    update public.creative_assets set campaign_id = v_id where brand_id = v_brand and campaign_id is null and not is_archived and status <> 'deployed';
    update public.reports         set campaign_id = v_id where brand_id = v_brand and campaign_id is null and sent_at is null;
  end if;

  -- Keep the World page's channels in step with what its campaigns run.
  update public.brands set
    marketing_types = array(select distinct unnest(marketing_types || array(select jsonb_array_elements_text(coalesce(p -> 'marketing_types', '[]'))))),
    channels = array(select distinct unnest(channels || array(select jsonb_array_elements_text(coalesce(p -> 'channels', '[]')))))
  where id = v_brand;

  return v_id;
end
$$;

revoke all on function public.launch_campaign(jsonb) from public, anon;
grant execute on function public.launch_campaign(jsonb) to authenticated;
