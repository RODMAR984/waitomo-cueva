import { supabase } from '../../supabaseClient';

/** Email de bienvenida trial (best-effort; requiere Resend en edge function). */
export async function sendTrialWelcomeEmail(organizationId) {
  if (!organizationId) return;
  try {
    const { error } = await supabase.functions.invoke('trial-emails', {
      body: { action: 'welcome', organizationId },
    });
    if (error) {
      console.warn('[trial-email] welcome invoke failed', error.message || error);
    }
  } catch (e) {
    console.warn('[trial-email] welcome invoke error', e?.message || e);
  }
}
