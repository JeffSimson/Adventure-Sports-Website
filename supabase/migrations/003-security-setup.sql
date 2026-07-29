-- Optional authenticated read policy template.
-- V7.4 routes production reads/writes through Netlify Functions, so no browser policy is required.
-- Leave these tables locked down unless you later replace Netlify Identity with Supabase Auth.
-- Verify that no permissive policies exist:
select schemaname,tablename,policyname,roles,cmd from pg_policies where schemaname='public';
