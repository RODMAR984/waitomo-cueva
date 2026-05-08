/**
 * Checkout Pro de Mercado Pago: la preferencia se crea en Edge Function (token secreto en servidor).
 */
import { supabase } from '../supabaseClient';

function isLocalWebHost() {
  if (typeof window === 'undefined') return false;
  const host = String(window.location?.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * @param {{ amount: number, title: string, externalReference: string, organizationId?: string|null }} p
 * @returns {Promise<{ init_point: string, sandbox_init_point?: string, preference_id?: string }>}
 */
export async function createCheckoutPreference({ amount, title, externalReference, organizationId }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('not_authenticated');
  }

  const body = {
    amount: Number(amount),
    title: String(title),
    external_reference: String(externalReference),
  };
  if (organizationId != null && String(organizationId).trim()) {
    body.organization_id = String(organizationId).trim();
  }
  const { data, error } = await supabase.functions.invoke('create-checkout-preference', {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(error.message || String(error));
  }
  if (data?.error) {
    if (data.error === 'mercadopago_checkout_disabled') {
      throw new Error('mercadopago_checkout_disabled');
    }
    const d = data.detail ? ` ${data.detail}` : '';
    throw new Error(`${data.error}${d}`);
  }
  const preferredCheckoutUrl = isLocalWebHost()
    ? (data?.sandbox_init_point || data?.init_point)
    : (data?.init_point || data?.sandbox_init_point);

  if (!preferredCheckoutUrl) {
    throw new Error('no_init_point');
  }

  return {
    init_point: preferredCheckoutUrl,
    sandbox_init_point: data?.sandbox_init_point || null,
    preference_id: data.preference_id,
  };
}
