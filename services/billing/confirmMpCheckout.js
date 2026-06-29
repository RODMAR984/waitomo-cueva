/**
 * Confirma pago MP tras volver del checkout (web) y activa abono en servidor.
 */
import { supabase } from '../supabaseClient';

export async function confirmMpCheckoutOnServer({
  paymentId,
  organizationId,
  collectionStatus,
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('not_authenticated');
  }

  const { data, error } = await supabase.functions.invoke('confirm-mp-checkout', {
    body: {
      payment_id: String(paymentId || ''),
      organization_id: organizationId ? String(organizationId) : undefined,
      collection_status: collectionStatus ? String(collectionStatus) : undefined,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(error.message || String(error));
  }
  if (data?.error) {
    throw new Error(String(data.error));
  }
  return data;
}
