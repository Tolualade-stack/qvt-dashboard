-- Fix: the weekly/bi-weekly schedule needs an explicit report kind type.

create or replace function public.ensure_reports() returns void
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
