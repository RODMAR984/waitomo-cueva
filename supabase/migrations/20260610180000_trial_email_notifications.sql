-- Emails de trial SaaS (dedupe) + cron diario de recordatorios.

CREATE TABLE IF NOT EXISTS public.trial_email_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  resend_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trial_email_sent_type_check
    CHECK (email_type IN ('welcome', 'ending_3d', 'ending_1d', 'expired')),
  CONSTRAINT trial_email_sent_org_type_unique UNIQUE (organization_id, email_type)
);

CREATE INDEX IF NOT EXISTS trial_email_sent_sent_at_idx
  ON public.trial_email_sent (sent_at DESC);

COMMENT ON TABLE public.trial_email_sent IS 'Registro de emails transaccionales de trial SaaS (Resend).';

ALTER TABLE public.trial_email_sent ENABLE ROW LEVEL SECURITY;

-- Solo service role / edge functions escriben; sin políticas para authenticated.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  v_job_name text := 'trial-email-reminders-daily';
  v_cron text := '0 14 * * *'; -- 14:00 UTC (~11:00 AR)
  v_fn_url text := 'https://nfjjkvjsssgxxsuocmhj.supabase.co/functions/v1/trial-emails';
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = v_job_name;

  PERFORM cron.schedule(
    v_job_name,
    v_cron,
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
