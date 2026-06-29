-- Modo IA: planificación consciente de ciclo (alcance libre por coach).

ALTER TABLE public.ai_generation_logs
  DROP CONSTRAINT IF EXISTS ai_generation_logs_feature_check;

ALTER TABLE public.ai_generation_logs
  ADD CONSTRAINT ai_generation_logs_feature_check
  CHECK (feature IN (
    'generate_routine',
    'rewrite_block',
    'draft_message',
    'rm_format',
    'cycle_plan'
  ));
