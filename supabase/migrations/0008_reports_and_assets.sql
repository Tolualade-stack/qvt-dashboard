-- =============================================================================
-- Phase 2c, part 4: client reports and creative assets.
--
-- Reports are scheduled automatically from each brand's reporting rhythm:
--   weekly    every Tuesday (standing day); due within 24 hours, i.e. by the
--             end of Wednesday, Lagos time
--   bi-weekly every other Tuesday, counting from Tue 3 Nov 2026; same 24 hours
--   monthly   for the month just ended; due by the end of the 7th
-- Scheduling starts from the pilot (3 Nov 2026), so there is no backlog.
-- Extra reports (e.g. for partnerships "as agreed") can be added by hand.
--
-- Creative assets move In production -> Ready -> Deployed; deployed ones count
-- against the world's creative-assets target.
-- =============================================================================

create type public.report_kind as enum ('weekly', 'biweekly', 'monthly', 'other');

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  brand_id        text not null references public.brands (id) on delete cascade,
  kind            public.report_kind not null,
  period_label    text not null,           -- e.g. "Week of 3 Nov", "November"
  due_at          timestamptz not null,
  sent_at         timestamptz,
  link            text,                    -- where the sent report lives
  owner_person_id uuid references public.people (id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now(),
  updated_by      uuid,
  unique (brand_id, kind, due_at)          -- lets the schedule run any number of times
);
create index reports_brand_due_idx on public.reports (brand_id, due_at desc);

-- Marking a report as sent records the real time; un-marking clears it.
create function public.track_report() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.sent_at is not null and old.sent_at is null then new.sent_at := now(); end if;
  elsif new.sent_at is not null then
    new.sent_at := now();
  end if;
  return new;
end
$$;

-- Creates any scheduled reports that are due up to now plus the next one ahead,
-- for every active brand. Safe to run any number of times. Runs with owner rights
-- so it can fill the schedule whoever opens the page; it only ever adds the
-- fixed schedule rows described above.
create function public.ensure_reports() returns void
language plpgsql security definer set search_path = '' as $$
declare
  pilot_start constant date := date '2026-11-03';     -- a Tuesday
  lagos_today date := (now() at time zone 'Africa/Lagos')::date;
  b record;
  standing date;
  month_start date;
  step int;
begin
  for b in select id, reporting from public.brands where not is_archived loop
    -- Weekly or bi-weekly, on Tuesdays.
    step := case
      when b.reporting ilike 'weekly%' then 7
      when b.reporting ilike 'bi-weekly%' then 14
      else null
    end;
    if step is not null then
      standing := pilot_start;
      while standing <= lagos_today + step loop
        insert into public.reports (brand_id, kind, period_label, due_at)
        values (
          b.id,
          (case when step = 7 then 'weekly' else 'biweekly' end)::public.report_kind,
          'Week of ' || to_char(standing, 'FMDD Mon'),
          ((standing + 1)::timestamp + time '23:59') at time zone 'Africa/Lagos'
        )
        on conflict (brand_id, kind, due_at) do nothing;
        standing := standing + step;
      end loop;
    end if;

    -- Monthly, for every month from the pilot's month to this one.
    if b.reporting ilike '%monthly%' then
      month_start := date_trunc('month', pilot_start)::date;
      while month_start <= date_trunc('month', lagos_today)::date loop
        insert into public.reports (brand_id, kind, period_label, due_at)
        values (
          b.id,
          'monthly',
          to_char(month_start, 'FMMonth YYYY'),
          (((month_start + interval '1 month')::date + 6)::timestamp + time '23:59') at time zone 'Africa/Lagos'
        )
        on conflict (brand_id, kind, due_at) do nothing;
        month_start := (month_start + interval '1 month')::date;
      end loop;
    end if;
  end loop;
end
$$;
revoke all on function public.ensure_reports() from public, anon;
grant execute on function public.ensure_reports() to authenticated;


create type public.asset_status as enum ('in_production', 'ready', 'deployed');

create table public.creative_assets (
  id                uuid primary key default gen_random_uuid(),
  brand_id          text not null references public.brands (id) on delete cascade,
  title             text not null,
  asset_type        text,                  -- e.g. Static, Video, Carousel, TVC cut (15 s)
  status            public.asset_status not null default 'in_production',
  status_changed_at timestamptz not null default now(),
  deployed_at       timestamptz,
  link              text,                  -- e.g. the Canva file
  owner_person_id   uuid references public.people (id) on delete set null,
  notes             text,
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
create index creative_assets_brand_idx on public.creative_assets (brand_id) where not is_archived;

create function public.track_asset() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
    new.deployed_at := case when new.status = 'deployed' then now() else null end;
  end if;
  return new;
end
$$;

create trigger track_report before insert or update on public.reports
  for each row execute function public.track_report();
create trigger track_asset before insert or update on public.creative_assets
  for each row execute function public.track_asset();
create trigger stamp_row before insert or update on public.reports
  for each row execute function public.stamp_row();
create trigger stamp_row before insert or update on public.creative_assets
  for each row execute function public.stamp_row();
create trigger write_audit after update or delete on public.reports
  for each row execute function public.write_audit();   -- scheduled inserts are not history
create trigger write_audit after insert or update or delete on public.creative_assets
  for each row execute function public.write_audit();

alter table public.reports         enable row level security;
alter table public.creative_assets enable row level security;

create policy "members read reports" on public.reports for select to authenticated using (public.is_member());
create policy "editors add reports" on public.reports for insert to authenticated with check (public.can_edit_brand(brand_id));
create policy "editors update reports" on public.reports for update to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));
create policy "admin removes reports" on public.reports for delete to authenticated using (public.is_admin());

create policy "members read assets" on public.creative_assets for select to authenticated using (public.is_member());
create policy "editors add assets" on public.creative_assets for insert to authenticated with check (public.can_edit_brand(brand_id));
create policy "editors update assets" on public.creative_assets for update to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));
create policy "admin removes assets" on public.creative_assets for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.reports, public.creative_assets to authenticated, service_role;
revoke all on public.reports, public.creative_assets from anon;
