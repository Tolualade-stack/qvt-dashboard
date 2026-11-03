-- =============================================================================
-- Phase 2c, part 2: "What changed?" notes, for updates that happen in
-- conversation (calls, WhatsApp, in person) so they are no longer lost.
-- A note records who wrote it and when, automatically, and cannot be edited
-- afterwards: the log is a record. Only the Admin can remove a note.
-- =============================================================================

create type public.note_source as enum ('call', 'whatsapp', 'in_person', 'email', 'other');

create table public.update_notes (
  id              uuid primary key default gen_random_uuid(),
  brand_id        text not null references public.brands (id) on delete cascade,
  content_item_id uuid references public.content_items (id) on delete set null,
  source          public.note_source,
  note            text not null check (length(trim(note)) > 0),
  author_name     text not null default 'System',   -- filled in by stamp_note(), kept even if the login changes
  created_at      timestamptz not null default now(),
  created_by      uuid
);
create index update_notes_brand_idx on public.update_notes (brand_id, created_at desc);
create index update_notes_item_idx on public.update_notes (content_item_id) where content_item_id is not null;

-- The writer and time come from the login, never from what the app sends.
create function public.stamp_note() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_at := now();
  new.created_by := auth.uid();
  new.author_name := public.current_user_name();
  return new;
end
$$;

create trigger stamp_note before insert on public.update_notes
  for each row execute function public.stamp_note();
create trigger write_audit after insert or delete on public.update_notes
  for each row execute function public.write_audit();

alter table public.update_notes enable row level security;
create policy "members read notes" on public.update_notes for select to authenticated
  using (public.is_member());
create policy "editors add notes" on public.update_notes for insert to authenticated
  with check (public.can_edit_brand(brand_id));
create policy "admin removes notes" on public.update_notes for delete to authenticated
  using (public.is_admin());
-- No update policy: notes cannot be changed once written.

grant select, insert, delete on public.update_notes to authenticated, service_role;
revoke all on public.update_notes from anon;
