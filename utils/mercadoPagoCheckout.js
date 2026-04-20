/**
 * Checkout Pro de Mercado Pago: la preferencia se crea en Edge Function (token secreto en servidor).
 */
import { supabase } from '../supabaseClient';

/**
 * @param {{ amount: number, title: string, externalReference: string }} p
 * @returns {Promise<{ init_point: string, preference_id?: string }>}
 */
export async function createCheckoutPreference({ amount, title, externalReference }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('not_authenticated');
  }

  const { data, error } = await supabase.functions.invoke('create-checkout-preference', {
    body: {
      amount: Number(amount),
      title: String(title),
      external_reference: String(externalReference),
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(error.message || String(error));
  }
  if (data?.error) {
    const d = data.detail ? ` ${data.detail}` : '';
    throw new Error(`${data.error}${d}`);
  }
  if (!data?.init_point) {
    throw new Error('no_init_point');
  }
  return {
    init_point: data.init_point,
    preference_id: data.preference_id,
  };
}
