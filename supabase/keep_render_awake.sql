-- Keeps the AVA Fit assistant on Render's free plan awake, so the chatbot answers at
-- once instead of taking about a minute after 15 idle minutes. Uses Supabase's own
-- scheduler (pg_cron) and HTTP client (pg_net), included in the Pro plan.
-- Note: a service awake all month uses ~744 of the workspace's 750 free Render hours.
-- To stop it: select cron.unschedule('ava-fit-keep-render-awake');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'ava-fit-keep-render-awake',
  '*/10 * * * *',
  $$ select net.http_get('https://ava-fit-assistant.onrender.com/health', timeout_milliseconds := 60000) $$
);
