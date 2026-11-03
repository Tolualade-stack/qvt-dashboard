-- =============================================================================
-- Phase 2c, part 3: the ads tracker and fund requests.
--   ads            one row per ad: channel and format, status, budget and spend
--                  (Naira or Dollars), and an "issue raised" clock for
--                  underperformance (flag and escalate within 24 hours)
--   fund_requests  money asked for to keep ads running; pending for more than
--                  24 hours is flagged
-- The database keeps the timestamps itself, like the content tracker.
-- =============================================================================

create type public.ad_status as enum ('not_started', 'set_up', 'live', 'paused', 'ended');
create type public.currency as enum ('NGN', 'USD');
create type public.fund_status as enum ('pending', 'funded', 'declined');

create table public.ads (
  id                uuid primary key default gen_random_uuid(),
  brand_id          text not null references public.brands (id) on delete cascade,
  name              text not null,
  channel           text not null,            -- channel id, e.g. tiktok
  format            text,                      -- e.g. Spark Ads, Bumper (6 s)
  owner_person_id   uuid references public.people (id) on delete set null,
  status            public.ad_status not null default 'not_started',
  status_changed_at timestamptz not null default now(),
  went_live_at      timestamptz,               -- first time it went live
  ended_at          timestamptz,
  currency          public.currency not null default 'NGN',
  budget            numeric(14, 2) check (budget is null or budget >= 0),
  spend_to_date     numeric(14, 2) not null default 0 check (spend_to_date >= 0),
  spend_updated_at  timestamptz,
  issue_raised_at   timestamptz,               -- underperformance flagged; cleared when resolved
  issue_note        text,
  notes             text,
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
create index ads_brand_idx on public.ads (brand_id) where not is_archived;

create table public.fund_requests (
  id           uuid primary key default gen_random_uuid(),
  brand_id     text not null references public.brands (id) on delete cascade,
  ad_id        uuid references public.ads (id) on delete set null,
  amount       numeric(14, 2) not null check (amount > 0),
  currency     public.currency not null default 'NGN',
  status       public.fund_status not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at  timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);
create index fund_requests_open_idx on public.fund_requests (brand_id) where status = 'pending';

-- Ad timestamps: when it changed status, first went live, ended, spend updated.
create function public.track_ad() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
    if new.status = 'live' and new.went_live_at is null then new.went_live_at := now(); end if;
    if new.status = 'ended' then new.ended_at := now(); end if;
    if tg_op = 'UPDATE' and old.status = 'ended' and new.status <> 'ended' then new.ended_at := null; end if;
  end if;
  if tg_op = 'INSERT' or new.spend_to_date is distinct from old.spend_to_date then
    new.spend_updated_at := now();
  end if;
  -- Raising an issue stamps the time; resolving clears the note too.
  if tg_op = 'UPDATE' and new.issue_raised_at is not null and old.issue_raised_at is null then
    new.issue_raised_at := now();
  end if;
  if new.issue_raised_at is null then new.issue_note := null; end if;
  return new;
end
$$;

-- Fund requests: the request time cannot be backdated; resolving stamps the time.
create function public.track_fund_request() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.requested_at := now();
  else
    new.requested_at := old.requested_at;
    if new.status <> 'pending' and old.status = 'pending' then new.resolved_at := now(); end if;
    if new.status = 'pending' then new.resolved_at := null; end if;
  end if;
  return new;
end
$$;

create trigger track_ad before insert or update on public.ads
  for each row execute function public.track_ad();
create trigger track_fund_request before insert or update on public.fund_requests
  for each row execute function public.track_fund_request();

create trigger stamp_row before insert or update on public.ads
  for each row execute function public.stamp_row();
create trigger stamp_row before insert or update on public.fund_requests
  for each row execute function public.stamp_row();
create trigger write_audit after insert or update or delete on public.ads
  for each row execute function public.write_audit();
create trigger write_audit after insert or update or delete on public.fund_requests
  for each row execute function public.write_audit();

-- Same access as content: everyone reads; whoever can edit the brand adds and
-- updates; only the Admin removes.
alter table public.ads           enable row level security;
alter table public.fund_requests enable row level security;

create policy "members read ads" on public.ads for select to authenticated using (public.is_member());
create policy "editors add ads" on public.ads for insert to authenticated with check (public.can_edit_brand(brand_id));
create policy "editors update ads" on public.ads for update to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));
create policy "admin removes ads" on public.ads for delete to authenticated using (public.is_admin());

create policy "members read fund requests" on public.fund_requests for select to authenticated using (public.is_member());
create policy "editors add fund requests" on public.fund_requests for insert to authenticated with check (public.can_edit_brand(brand_id));
create policy "editors update fund requests" on public.fund_requests for update to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));
create policy "admin removes fund requests" on public.fund_requests for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.ads, public.fund_requests to authenticated, service_role;
revoke all on public.ads, public.fund_requests from anon;
