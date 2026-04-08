/**
 * Identidad Waitomo “oficial” en la app.
 * - NO usar el nombre de la organización: puede haber homónimos y confunde con el mail del usuario.
 * - Fuente de verdad: UUID de la fila `organizations` de Waitomo en Supabase.
 *
 * Configurá el id en app.json → expo.extra.waitomoOrganizationId
 * o en build: EXPO_PUBLIC_WAITOMO_ORG_ID=<uuid>
 */
import Constants from 'expo-constants';

const fromExtra = Constants.expoConfig?.extra?.waitomoOrganizationId;
const fromEnv =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_WAITOMO_ORG_ID
    ? String(process.env.EXPO_PUBLIC_WAITOMO_ORG_ID).trim()
    : '';

const fromExtraStr = typeof fromExtra === 'string' ? fromExtra.trim() : '';

/** UUID de la org Waitomo en producción; si está vacío, se usa fallback por nombre solo en dev (legacy). */
export const WAITOMO_ORGANIZATION_ID = (fromEnv || fromExtraStr || '') || null;

/**
 * @param {null|{ id?: string, name?: string }} org
 * @returns {boolean}
 */
export function isWaitomoOrg(org) {
  if (!org) return false;

  if (WAITOMO_ORGANIZATION_ID) {
    return String(org.id) === WAITOMO_ORGANIZATION_ID;
  }

  // Legacy (sin UUID en config): compatibilidad local; en producción conviene fijar el UUID.
  const name = (org.name || '').trim();
  return name === 'Waitomo Training';
}
