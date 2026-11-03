-- Who uploaded each set of numbers, filled in from the login (like notes), so
-- everyone can see "uploaded by Viche" without needing access to logins.
-- Automatic imports (sheet, ad platforms) run without a login and read "PRIME".

alter table public.channel_metrics add column author_name text not null default 'PRIME';

create function public.stamp_metric_author() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.author_name := public.current_user_name();
  end if;
  return new;
end
$$;

create trigger stamp_metric_author before insert on public.channel_metrics
  for each row execute function public.stamp_metric_author();
