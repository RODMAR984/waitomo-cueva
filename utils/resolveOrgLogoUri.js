import { supabase } from '../supabaseClient';

const BUCKET_ORG_LOGOS = 'org-logos';

/** Resuelve logo_url de organizations (URL absoluta o path en bucket org-logos). */
export function resolveOrgLogoUri(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s.startsWith('http')) return s;
  try {
    const path = s.replace(/^org-logos\//i, '');
    const { data } = supabase.storage.from(BUCKET_ORG_LOGOS).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}
