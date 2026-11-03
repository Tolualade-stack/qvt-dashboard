-- =============================================================================
-- Phase 2b: each brand's world gets its own visuals and campaign setup.
--   - banner and logo images (stored in Supabase Storage, bucket "brand-media")
--   - the colours read from the logo: `colour` is the main one, `palette` all of them
--   - marketing types, channels and targets chosen during onboarding
-- =============================================================================

alter table public.brands
  add column banner_path            text,       -- file path inside the brand-media bucket
  add column logo_path              text,
  add column palette                text[] not null default '{}',  -- colours found in the logo
  add column marketing_types        text[] not null default '{}',  -- e.g. {digital, traditional}
  add column channels               text[] not null default '{}',  -- e.g. {instagram, tiktok}
  add column creative_assets_target int,
  add column tv_spots_target        int,
  add column radio_spots_target     int;

-- Ducros takes its colours from its logo: red, orange, yellow and deep red.
update public.brands set
  colour = '#D6232A',
  palette = array['#D6232A', '#EE7D1A', '#F9BE2C', '#9E1B20'],
  marketing_types = array['digital'],
  channels = array['instagram', 'facebook', 'tiktok', 'youtube']
where id = 'ducros';

update public.brands set
  palette = array['#3B6FD4'],
  marketing_types = array['digital', 'traditional', 'kol'],
  channels = array['instagram', 'facebook', 'tiktok', 'youtube', 'google_ads']
where id = 'alieve';


-- -----------------------------------------------------------------------------
-- Image storage. Banners and logos are brand marketing images, so the bucket is
-- public to view (fast to load anywhere); only the Admin can upload or change.
-- Files are limited to 5 MB and to photo formats (no SVG, which can carry scripts).
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-media', 'brand-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "admin uploads brand media" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-media' and public.is_admin());
create policy "admin replaces brand media" on storage.objects for update to authenticated
  using (bucket_id = 'brand-media' and public.is_admin())
  with check (bucket_id = 'brand-media' and public.is_admin());
create policy "admin removes brand media" on storage.objects for delete to authenticated
  using (bucket_id = 'brand-media' and public.is_admin());
