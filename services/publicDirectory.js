/**
 * Directorio público de organizaciones (FitEngine).
 * Capa de servicio: la app importa desde aquí o desde `utils/publicDirectory` (re-export legacy).
 */
import { supabase } from '../supabaseClient';

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

/**
 * @param {{ limit?: number, offset?: number, type?: 'gym'|'coach'|null }} opts
 * @returns {{ rows: Array<Record<string, unknown>>, error: Error | null }}
 */
export async function fetchPublicOrganizationDirectory(opts = {}) {
  try {
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(opts.limit) || DEFAULT_LIMIT),
    );
    const offset = Math.max(0, Number(opts.offset) || 0);
    const t = opts.type === 'gym' || opts.type === 'coach' ? opts.type : null;
    const { data, error } = await supabase.rpc('list_public_organizations_directory', {
      p_limit: limit,
      p_offset: offset,
      p_type: t,
    });
    if (error) {
      return { rows: [], error };
    }
    return { rows: Array.isArray(data) ? data : [], error: null };
  } catch (e) {
    return { rows: [], error: e };
  }
}
