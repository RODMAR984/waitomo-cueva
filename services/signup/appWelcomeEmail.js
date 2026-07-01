import { supabase } from '../../supabaseClient';

/**
 * Emails de bienvenida FitEngine (best-effort; requiere Resend + función app-emails).
 * @param {'client'|'staff'|'owner_trial'|'client_joined'} audience
 * @param {{ organizationId?: string }} [opts]
 */
export async function sendAppWelcomeEmail(audience, opts = {}) {
  try {
    const body = { action: 'welcome', audience };
    if (opts.organizationId) body.organizationId = opts.organizationId;
    const { error } = await supabase.functions.invoke('app-emails', { body });
    if (error) {
      console.warn('[app-email] welcome invoke failed', audience, error.message || error);
    }
  } catch (e) {
    console.warn('[app-email] welcome invoke error', audience, e?.message || e);
  }
}

/** @deprecated Usar sendAppWelcomeEmail('owner_trial', { organizationId }) */
export async function sendTrialWelcomeEmail(organizationId) {
  return sendAppWelcomeEmail('owner_trial', { organizationId });
}