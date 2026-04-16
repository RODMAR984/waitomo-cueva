import { supabase } from '../supabaseClient';

/**
 * Última fila user_abonos del usuario (misma query que ClientScreen).
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function fetchLatestUserAbono(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('user_abonos')
    .select(
      'id, plan_id, status, start_date, end_date, sessions_total, sessions_used, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return row || null;
}
