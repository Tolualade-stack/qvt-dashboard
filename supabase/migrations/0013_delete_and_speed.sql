-- =============================================================================
-- 1. Deleting a campaign (Admin only): its unsent reports and budget lines go,
--    its content, ads and assets are archived (kept in the history), and the
--    campaign itself is removed. Deleting a whole brand needs nothing new: every
--    table already follows the brand with "on delete cascade".
-- 2. Speed: the regular report schedule was being checked on every page load.
--    It now runs at most once every 15 minutes.
-- =============================================================================

create function public.delete_campaign(p_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only the Admin can delete a campaign.';
  end if;
  update public.content_items   set is_archived = true where campaign_id = p_id;
  update public.ads             set is_archived = true where campaign_id = p_id;
  update public.creative_assets set is_archived = true where campaign_id = p_id;
  delete from public.reports      where campaign_id = p_id and sent_at is null;
  delete from public.budget_lines where campaign_id = p_id;
  delete from public.campaigns    where id = p_id;
end
$$;
revoke all on function public.delete_campaign(uuid) from public, anon;
grant execute on function public.delete_campaign(uuid) to authenticated;


create table if not exists private.job_runs (
  name   text primary key,
  ran_at timestamptz not null
);

drop function public.ensure_reports();
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
  -- Ran in the last 15 minutes: nothing new can be due, so skip the work.
  if exists (select 1 from private.job_runs where name = 'ensure_reports' and ran_at > now() - interval '15 minutes') then
    return;
  end if;
  insert into private.job_runs (name, ran_at) values ('ensure_reports', now())
  on conflict (name) do update set ran_at = excluded.ran_at;

  for b in select id, reporting from public.brands where not is_archived loop
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
