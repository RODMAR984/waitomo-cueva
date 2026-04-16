import { supabase } from '../supabaseClient';
import { normalizeBlockPlanKey } from './trainingBlockPlan';

/**
 * Carga mensajes del feed para los tres ámbitos usados en TrabajoDelDia.
 */
export async function fetchTrabajoDiaFeedMessages({
  organizationId,
  planValueForKey,
  fechaYmd,
  horarioNormalized,
}) {
  if (!organizationId) return { data: [], error: null };
  const pk = normalizeBlockPlanKey(planValueForKey) || String(planValueForKey || '').trim();

  const { data, error } = await supabase
    .from('trabajo_dia_feed_messages')
    .select('id, feed_kind, plan_key, session_date, slot_label, author_id, payload, client_msg_id, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(3000);

  if (error) return { data: [], error };

  const fecha = String(fechaYmd || '').slice(0, 10);
  const hora = horarioNormalized ? String(horarioNormalized).slice(0, 5) : '';

  const rows = (data || []).filter((r) => {
    if (r.feed_kind === 'global') return true;
    if (r.feed_kind === 'plan') return (r.plan_key || '') === pk;
    if (r.feed_kind === 'day') {
      const sd = r.session_date ? String(r.session_date).slice(0, 10) : '';
      if (sd !== fecha || (r.plan_key || '') !== pk) return false;
      const sl = r.slot_label ? String(r.slot_label).slice(0, 5) : '';
      if (hora) return sl === hora;
      return !sl;
    }
    return false;
  });

  return { data: rows, error: null };
}

export function rowToFeedPayload(row) {
  const p = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const ts =
    p.timestamp ||
    (row.created_at ? new Date(row.created_at).getTime() : Date.now());
  return {
    ...p,
    id: p.id || row.client_msg_id,
    timestamp: ts,
    scope:
      row.feed_kind === 'global'
        ? 'global'
        : row.feed_kind === 'plan'
          ? 'plan'
          : 'day',
  };
}

export async function insertTrabajoDiaFeedMessage({
  organizationId,
  feedKind,
  planKey,
  sessionDate,
  slotLabel,
  authorId,
  payload,
  clientMsgId,
}) {
  if (!organizationId || !authorId || !clientMsgId) return { error: new Error('missing fields') };
  return supabase.from('trabajo_dia_feed_messages').insert({
    organization_id: organizationId,
    feed_kind: feedKind,
    plan_key: feedKind === 'global' ? null : normalizeBlockPlanKey(planKey) || planKey,
    session_date: feedKind === 'day' ? sessionDate : null,
    slot_label: feedKind === 'day' ? (slotLabel ? String(slotLabel).slice(0, 5) : null) : null,
    author_id: authorId,
    payload,
    client_msg_id: clientMsgId,
  });
}
