-- =============================================================================
-- Phase 3: live numbers, media plans and budget spread, and deadline settings.
--
-- channel_metrics  one row per upload of a channel's numbers for a period.
--                  `source` says where they came from: typed in now; later the
--                  Google Sheet and the ad platforms (Meta, TikTok, Google Ads)
--                  write into this same table, so nothing gets rebuilt.
-- budget_lines     the media plan's money per channel (and format), so actual
--                  ad spend can be shown against each planned amount.
-- brand documents  the media plan and strategy, as a link or an uploaded file
--                  (private storage: only signed-in members can open them).
-- deadline settings the first-draft SLA for assets, per brand.
-- =============================================================================

create type public.metric_source as enum ('manual', 'sheet', 'meta', 'tiktok', 'google_ads', 'other');

create table public.channel_metrics (
  id               uuid primary key default gen_random_uuid(),
  brand_id         text not null references public.brands (id) on delete cascade,
  channel          text not null,               -- channel id, or 'tv' / 'radio'
  period_start     date not null,
  period_end       date not null check (period_end >= period_start),
  impressions      bigint check (impressions >= 0),
  reach            bigint check (reach >= 0),
  likes            bigint check (likes >= 0),
  clicks           bigint check (clicks >= 0),
  followers_gained bigint,
  video_views      bigint check (video_views >= 0),
  spots_aired      int check (spots_aired >= 0),
  source           public.metric_source not null default 'manual',
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
create index channel_metrics_brand_idx on public.channel_metrics (brand_id, channel, period_end desc, created_at desc);

create table public.budget_lines (
  id             uuid primary key default gen_random_uuid(),
  brand_id       text not null references public.brands (id) on delete cascade,
  channel        text not null,
  format         text,                         -- empty = the whole channel
  label          text,                         -- optional wording from the plan
  planned_amount numeric(14, 2) not null check (planned_amount >= 0),
  currency       public.currency not null default 'NGN',
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid
);
create index budget_lines_brand_idx on public.budget_lines (brand_id);

-- Media plan and strategy: a live link, an uploaded file, or both.
alter table public.brands
  add column media_plan_url   text,
  add column media_plan_path  text,
  add column strategy_url     text,
  add column strategy_path    text,
  -- First-draft deadline for creative assets, counted from "Copy ready".
  add column asset_sla_unit   text not null default 'hours' check (asset_sla_unit in ('hours', 'working_days')),
  add column asset_sla_warn   int not null default 24,
  add column asset_sla_escalate int not null default 48,
  add column asset_sla_hard   int not null default 72;

-- Alieve: warn at 3 working days, hard escalation at 5 working days.
update public.brands set asset_sla_unit = 'working_days', asset_sla_warn = 3, asset_sla_escalate = 5, asset_sla_hard = 5
where id = 'alieve';
-- Ducros (and new brands by default): 24 h warning, Digital Lead at 48 h, hard at 72 h.

create trigger stamp_row before insert or update on public.channel_metrics
  for each row execute function public.stamp_row();
create trigger stamp_row before insert or update on public.budget_lines
  for each row execute function public.stamp_row();
create trigger write_audit after insert or update or delete on public.channel_metrics
  for each row execute function public.write_audit();
create trigger write_audit after insert or update or delete on public.budget_lines
  for each row execute function public.write_audit();

alter table public.channel_metrics enable row level security;
alter table public.budget_lines    enable row level security;

create policy "members read numbers" on public.channel_metrics for select to authenticated using (public.is_member());
create policy "editors add numbers" on public.channel_metrics for insert to authenticated with check (public.can_edit_brand(brand_id));
create policy "editors fix numbers" on public.channel_metrics for update to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));
create policy "admin removes numbers" on public.channel_metrics for delete to authenticated using (public.is_admin());

-- The budget is part of the brand's plan: the Admin sets it; everyone can see it.
create policy "members read budget" on public.budget_lines for select to authenticated using (public.is_member());
create policy "admin writes budget" on public.budget_lines for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.channel_metrics, public.budget_lines to authenticated, service_role;
revoke all on public.channel_metrics, public.budget_lines from anon;

-- Private bucket for plans and strategies (client documents). Not public: the
-- app gives signed-in members a link that works for a short time only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-documents', 'brand-documents', false, 20971520, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
on conflict (id) do nothing;

create policy "members read brand documents" on storage.objects for select to authenticated
  using (bucket_id = 'brand-documents' and public.is_member());
create policy "admin uploads brand documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-documents' and public.is_admin());
create policy "admin replaces brand documents" on storage.objects for update to authenticated
  using (bucket_id = 'brand-documents' and public.is_admin()) with check (bucket_id = 'brand-documents' and public.is_admin());
create policy "admin removes brand documents" on storage.objects for delete to authenticated
  using (bucket_id = 'brand-documents' and public.is_admin());
