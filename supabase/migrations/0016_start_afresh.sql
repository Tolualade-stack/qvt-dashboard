-- =============================================================================
-- "Start afresh" for a brand (Admin only). The world itself stays: its name,
-- logo, colours, profile, team, Leave Mode, reporting rhythm and targets.
-- Everything worked on inside it is cleared: campaigns, content, ads, fund
-- requests, reports, creative assets, numbers, budget lines, notes, the media
-- plan / strategy links and the Canva link. Its activity feed starts again
-- from the moment of the reset, and regular reports are only scheduled from
-- then on (so old overdue reports don't come back).
-- =============================================================================

alter table public.brands add column fresh_start_at timestamptz;

-- Lets one transaction skip the audit trail row-by-row (used only by the reset,
-- which leaves a single "started afresh" entry instead of dozens of deletions).
create or replace function public.write_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  if coalesce(current_setting('prime.quiet_audit', true), '') = 'on' then
    return null;
  end if;

  -- Skip saves that changed nothing but the timestamps.
  if tg_op = 'UPDATE'
     and (v_old - 'updated_at' - 'updated_by') = (v_new - 'updated_at' - 'updated_by') then
    return null;
  end if;

  insert into public.audit_log (table_name, row_id, action, changed_by, changed_by_name, old_data, new_data)
  values (tg_table_name, coalesce(v_row ->> 'id', v_row ->> 'user_id'), lower(tg_op),
          auth.uid(), public.current_user_name(), v_old, v_new);
  return null;
end
$$;

create function public.start_brand_afresh(p_brand text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only the Admin can start a world afresh.';
  end if;
  if not exists (select 1 from public.brands where id = p_brand) then
    raise exception 'That world no longer exists.';
  end if;

  perform set_config('prime.quiet_audit', 'on', true);
  delete from public.work_issues     where brand_id = p_brand;
  delete from public.fund_requests   where brand_id = p_brand;
  delete from public.update_notes    where brand_id = p_brand;
  delete from public.channel_metrics where brand_id = p_brand;
  delete from public.budget_lines    where brand_id = p_brand;
  delete from public.reports         where brand_id = p_brand;
  delete from public.creative_assets where brand_id = p_brand;
  delete from public.ads             where brand_id = p_brand;
  delete from public.content_items   where brand_id = p_brand;
  delete from public.campaigns       where brand_id = p_brand;  -- team, areas and counted work follow
  perform set_config('prime.quiet_audit', 'off', true);

  -- One entry in the history: "started … afresh".
  update public.brands set
    fresh_start_at     = now(),
    media_plan_url     = null,
    media_plan_path    = null,
    strategy_url       = null,
    strategy_path      = null,
    canva_calendar_url = null
  where id = p_brand;
end
$$;
revoke all on function public.start_brand_afresh(text) from public, anon;
grant execute on function public.start_brand_afresh(text) to authenticated;

-- Regular reports: from the pilot start, or from the brand's fresh start if later
-- (keeping the same Tuesday rhythm).
drop function public.ensure_reports();
create function public.ensure_reports() returns void
language plpgsql security definer set search_path = '' as $$
declare
  pilot_start constant date := date '2026-11-03';     -- a Tuesday
  lagos_today date := (now() at time zone 'Africa/Lagos')::date;
  b record;
  fresh date;
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

  for b in select id, reporting, fresh_start_at from public.brands where not is_archived loop
    fresh := coalesce((b.fresh_start_at at time zone 'Africa/Lagos')::date, pilot_start);
    step := case
      when b.reporting ilike 'weekly%' then 7
      when b.reporting ilike 'bi-weekly%' then 14
      else null
    end;
    if step is not null then
      standing := pilot_start;
      while standing <= lagos_today + step loop
        if standing >= fresh then
          insert into public.reports (brand_id, kind, period_label, due_at)
          values (
            b.id,
            (case when step = 7 then 'weekly' else 'biweekly' end)::public.report_kind,
            'Week of ' || to_char(standing, 'FMDD Mon'),
            ((standing + 1)::timestamp + time '23:59') at time zone 'Africa/Lagos'
          )
          on conflict (brand_id, kind, due_at) do nothing;
        end if;
        standing := standing + step;
      end loop;
    end if;

    if b.reporting ilike '%monthly%' then
      month_start := date_trunc('month', pilot_start)::date;
      while month_start <= date_trunc('month', lagos_today)::date loop
        if month_start >= fresh then
          insert into public.reports (brand_id, kind, period_label, due_at)
          values (
            b.id,
            'monthly',
            to_char(month_start, 'FMMonth YYYY'),
            (((month_start + interval '1 month')::date + 6)::timestamp + time '23:59') at time zone 'Africa/Lagos'
          )
          on conflict (brand_id, kind, due_at) do nothing;
        end if;
        month_start := (month_start + interval '1 month')::date;
      end loop;
    end if;
  end loop;
end
$$;
revoke all on function public.ensure_reports() from public, anon;
grant execute on function public.ensure_reports() to authenticated;
