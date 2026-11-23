-- The daily keep-awake check (/api/health) asks for one workspace without a
-- login. Signed-out visitors may now ask, but the access rules only let
-- signed-in members see rows, so they always get an empty answer.
grant select on public.workspaces to anon;
