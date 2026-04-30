-- Programa ejecución nocturna de admin-ai-insights (una vez por día).
-- Nota: usa service_role_key del proyecto para invocar la Edge Function.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_job_name text := 'admin-ai-insights-nightly';
  v_cron text := '15 3 * * *'; -- 03:15 UTC (ajustable)
  v_fn_url text := 'https://nfjjkvjsssgxxsuocmhj.functions.supabase.co/admin-ai-insights';
begin
  -- Evita duplicados al re-aplicar migración en otros entornos.
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = v_job_name;

  perform cron.schedule(
    v_job_name,
    v_cron,
    format(
      $sql$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := %L::jsonb
      ) as request_id;
      $sql$,
      v_fn_url,
      '{"source":"cron"}'
    )
  );
end;
$$;
