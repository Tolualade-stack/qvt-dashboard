-- =============================================================================
-- Phase 2c, part 1: the content tracker.
-- One row per content piece. Its status moves Planned -> ... -> Posted.
-- The database itself keeps the timestamps the deadline flags will need, and
-- counts revision rounds, so nothing depends on the app remembering to.
-- =============================================================================

create type public.content_status as enum (
  'planned', 'copy_ready', 'asset_in_progress', 'awaiting_approval', 'approved', 'scheduled', 'posted'
);

create table public.content_items (
  id                uuid primary key default gen_random_uuid(),
  brand_id          text not null references public.brands (id) on delete cascade,
  title             text not null,
  platforms         text[] not null default '{}',      -- channel ids, e.g. {instagram, tiktok}, or tv/radio
  owner_person_id   uuid references public.people (id) on delete set null,
  planned_date      date,
  needs_approval    boolean not null default false,    -- a real stakeholder/influencer is involved
  status            public.content_status not null default 'planned',
  status_changed_at timestamptz not null default now(),
  copy_ready_at     timestamptz,                       -- starts the asset first-draft clock
  posted_at         timestamptz,
  post_url          text,
  revision_round    int not null default 0,            -- times sent back from approval
  notes             text,
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
create index content_items_brand_idx on public.content_items (brand_id) where not is_archived;

-- Keeps the status timestamps and the revision count right on every save.
create function public.track_content_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
    if new.status = 'copy_ready' and new.copy_ready_at is null then
      new.copy_ready_at := now();
    end if;
    if new.status = 'posted' and new.posted_at is null then
      new.posted_at := now();
    end if;
    -- Sent back from approval for changes: that is one more revision round.
    if tg_op = 'UPDATE' and old.status = 'awaiting_approval' and new.status = 'asset_in_progress' then
      new.revision_round := old.revision_round + 1;
    end if;
    -- Moved back out of Posted (a mistake undone): clear the posted time.
    if tg_op = 'UPDATE' and old.status = 'posted' and new.status <> 'posted' then
      new.posted_at := null;
    end if;
  end if;
  return new;
end
$$;

create trigger track_content_status before insert or update on public.content_items
  for each row execute function public.track_content_status();
create trigger stamp_row before insert or update on public.content_items
  for each row execute function public.stamp_row();
create trigger write_audit after insert or update or delete on public.content_items
  for each row execute function public.write_audit();

-- Access: everyone with a login can see content; whoever can edit the brand can
-- add and update it (Admin, Updates Manager, leave cover during Leave Mode).
-- Removing is Admin only, and the app archives rather than deletes.
alter table public.content_items enable row level security;
create policy "members read content" on public.content_items for select to authenticated
  using (public.is_member());
create policy "editors add content" on public.content_items for insert to authenticated
  with check (public.can_edit_brand(brand_id));
create policy "editors update content" on public.content_items for update to authenticated
  using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));
create policy "admin removes content" on public.content_items for delete to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.content_items to authenticated, service_role;
revoke all on public.content_items from anon;
