-- Dedupe de bienvenidas por usuario (cliente, staff, unión a gym).

CREATE TABLE IF NOT EXISTS public.app_email_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email_type text NOT NULL,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  resend_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_email_sent_type_check
    CHECK (email_type IN ('welcome_client', 'welcome_staff', 'welcome_client_joined', 'welcome_owner_trial'))
);

CREATE UNIQUE INDEX IF NOT EXISTS app_email_sent_user_type_no_org_idx
  ON public.app_email_sent (user_id, email_type)
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_email_sent_user_type_org_idx
  ON public.app_email_sent (user_id, email_type, organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS app_email_sent_sent_at_idx
  ON public.app_email_sent (sent_at DESC);

COMMENT ON TABLE public.app_email_sent IS 'Emails de bienvenida FitEngine (cliente, staff, gym) vía Resend.';

ALTER TABLE public.app_email_sent ENABLE ROW LEVEL SECURITY;

-- Cron trial: también puede llamar app-emails (trial-emails sigue siendo alias).
DO $$
DECLARE
  v_job_name text := 'trial-email-reminders-daily';
  v_fn_url text := 'https://nfjjkvjsssgxxsuocmhj.supabase.co/functions/v1/app-emails';
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = v_job_name;

  PERFORM cron.schedule(
    v_job_name,
    '0 14 * * *',
    format(
      $sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := %L::jsonb
      ) AS request_id;
      $sql$,
      v_fn_url,
      '{"action":"process_reminders"}'
    )
  );
END;
$$;
