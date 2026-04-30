import { supabase } from '../supabaseClient';

/**
 * Crea sesión de Stripe Checkout en Edge Function.
 * @param {{
 *  organizationId: string,
 *  memberUserId: string,
 *  planId: string,
 *  periodo: string,
 *  amount: number,
 *  currency: string,
 *  title: string,
 * }} p
 */
export async function createStripeCheckoutSession({
  organizationId,
  memberUserId,
  planId,
  periodo,
  amount,
  currency,
  title,
}) {
  const { data, error } = await supabase.functions.invoke('create-stripe-checkout-session', {
    body: {
      organization_id: organizationId,
      member_user_id: memberUserId,
      plan_id: planId,
      periodo,
      amount: Number(amount),
      currency: String(currency || 'USD').toLowerCase(),
      title: String(title || 'FitEngine'),
    },
  });
  if (error) throw new Error(error.message || String(error));
  if (!data?.ok || !data?.checkout_url) throw new Error(data?.error || 'stripe_checkout_failed');
  return {
    checkout_url: String(data.checkout_url),
    payment_id: String(data.payment_id || ''),
  };
}
