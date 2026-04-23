import { supabase } from '../supabaseClient';

/**
 * Supabase devuelve error genérico "non-2xx"; el cuerpo JSON de la función suele traer `error` / `detail`.
 */
function throwInvokeError(error, data) {
  const base = error?.message || String(error || 'invoke_failed');
  const parts = [base];
  if (data != null && typeof data === 'object') {
    if (data.step != null) parts.push(`paso: ${String(data.step)}`);
    if (data.hint != null) parts.push(String(data.hint));
    if (data.error != null) parts.push(String(data.error));
    if (data.detail != null) parts.push(String(data.detail));
    if (data.message != null && data.message !== data.error) parts.push(String(data.message));
  }
  const ctx = error?.context;
  if (ctx && typeof ctx === 'object') {
    if (ctx.status != null) parts.push(`HTTP ${ctx.status}`);
    const b = ctx.body;
    if (typeof b === 'string' && b.trim()) {
      try {
        const j = JSON.parse(b);
        if (j?.error) parts.push(String(j.error));
        if (j?.detail) parts.push(String(j.detail));
      } catch {
        parts.push(b.slice(0, 240));
      }
    }
  }
  const msg = [...new Set(parts.filter(Boolean))].join(' — ');
  const err = new Error(msg);
  err.original = error;
  err.responseData = data;
  throw err;
}

async function invokeGenerateRoutine(body) {
  const { data, error } = await supabase.functions.invoke('generate-routine', { body });
  if (error) throwInvokeError(error, data);
  if (!data?.ok || !data?.result) {
    throw new Error(data?.error || 'ai_generation_failed');
  }
  return data;
}

export async function generateRoutineDraft({
  organizationId,
  targetClientId = null,
  sessionDate,
  slotLabel,
  planKey,
  durationMinutes = 45,
  focus = '',
  extraNotes = '',
}) {
  return invokeGenerateRoutine({
    mode: 'routine',
    organization_id: organizationId,
    target_client_id: targetClientId,
    session_date: sessionDate,
    slot_label: slotLabel,
    plan_key: planKey,
    duration_minutes: durationMinutes,
    focus,
    extra_notes: extraNotes,
  });
}

export async function rewriteBlockWithAi({
  organizationId,
  rawText,
  titleHint = '',
  planKey = '',
  slotLabel = '',
}) {
  return invokeGenerateRoutine({
    mode: 'rewrite',
    organization_id: organizationId,
    raw_text: rawText,
    title_hint: titleHint,
    plan_key: planKey,
    slot_label: slotLabel,
  });
}

export async function draftMessageWithAi({
  organizationId,
  rawText,
  titleHint = '',
  planKey = '',
  slotLabel = '',
  sessionDate = '',
  extraNotes = '',
}) {
  return invokeGenerateRoutine({
    mode: 'message',
    organization_id: organizationId,
    raw_text: rawText,
    title_hint: titleHint,
    plan_key: planKey,
    slot_label: slotLabel,
    session_date: sessionDate,
    extra_notes: extraNotes,
  });
}

export async function normalizeRmPatternWithAi({
  organizationId,
  rawText,
  planKey = '',
}) {
  return invokeGenerateRoutine({
    mode: 'rm_format',
    organization_id: organizationId,
    raw_text: rawText,
    plan_key: planKey,
  });
}
