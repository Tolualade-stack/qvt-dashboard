-- =============================================================================
-- Weekly spend against the media plan. Each budget line can carry "spent so
-- far", entered once a week by whoever covers ads or numbers. Where a line has
-- it, the budget spread uses it instead of adding up each ad's spend.
-- Only the spend can be changed this way; the planned amount stays Admin-only.
-- =============================================================================

alter table public.budget_lines
  add column spend_to_date numeric(14, 2) check (spend_to_date is null or spend_to_date >= 0),
  add column spend_updated_at timestamptz;

-- p_lines: [{ "id": "...", "spent": 120000 }]. Returns how many were saved.
create function public.record_spend(p_lines jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  line record;
  saved int := 0;
begin
  for item in select * from jsonb_array_elements(p_lines) loop
    select id, brand_id, campaign_id into line from public.budget_lines where id = (item ->> 'id')::uuid;
    if line.id is null then continue; end if;
    if not public.can_edit_brand(line.brand_id) then continue; end if;
    if line.campaign_id is not null
       and not (public.can_cover(line.campaign_id, 'ads') or public.can_cover(line.campaign_id, 'numbers')) then
      continue;
    end if;
    update public.budget_lines
      set spend_to_date = nullif(item ->> 'spent', '')::numeric,
          spend_updated_at = now()
      where id = line.id;
    saved := saved + 1;
  end loop;
  return saved;
end
$$;
revoke all on function public.record_spend(jsonb) from public, anon;
grant execute on function public.record_spend(jsonb) to authenticated;
