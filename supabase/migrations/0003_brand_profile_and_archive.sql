-- =============================================================================
-- Brand profile (shown under a world's hero) and archiving.
-- Archived brands disappear from Home but keep all their data and history; the
-- Admin can restore them at any time.
-- =============================================================================

alter table public.brands
  add column is_archived boolean not null default false,
  add column about       text,      -- 1 or 2 lines about the brand
  add column website     text,
  add column industry    text,      -- e.g. FMCG
  add column category    text,      -- e.g. Spices & seasonings
  add column products    text[] not null default '{}';  -- e.g. {Curry, Thyme}

-- Ducros Spices first, then Alieve Pain Relief. CCR is set aside for now.
update public.brands set sort_order = 1,
  about    = 'Spices and herbs for Nigerian kitchens, from the signature curry powder to dried thyme. A McCormick brand, brought to Nigeria by Canvest.',
  website  = 'https://canvestgroup.com',
  industry = 'FMCG',
  category = 'Spices & seasonings',
  products = array['Curry', 'Thyme']
where id = 'ducros';

update public.brands set sort_order = 2,
  industry = 'Pharma & health',
  category = 'Pain relief'
where id = 'alieve';

update public.brands set sort_order = 3, is_archived = true where id = 'ccr';
