-- Newer Supabase projects no longer expose public tables to the Data API by default.
-- Signed-in users reach rows through RLS; anonymous visitors get nothing.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
