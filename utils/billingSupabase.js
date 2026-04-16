import { supabase } from '../supabaseClient';

export function paymentRowToLocal(row) {
  if (!row) return null;
  return {
    id: row.client_id,
    organization_id: row.organization_id,
    userId: row.member_user_id,
    planId: row.plan_id,
    periodo: row.periodo,
    monto: Number(row.monto),
    moneda: row.moneda || 'ARS',
    metodo: row.metodo,
    status: row.status,
    pagadoParcial: row.pagado_parcial != null ? Number(row.pagado_parcial) : undefined,
    paidAt: row.paid_at ? new Date(row.paid_at).getTime() : undefined,
    lastPartialAt: row.last_partial_at ? new Date(row.last_partial_at).getTime() : undefined,
    refundAt: row.refund_at ? new Date(row.refund_at).getTime() : undefined,
    refundAmount: row.refund_amount != null ? Number(row.refund_amount) : undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

export function subscriptionRowToLocal(row) {
  if (!row) return null;
  return {
    id: row.client_id,
    organization_id: row.organization_id,
    userId: row.member_user_id,
    planId: row.plan_id,
    tipo: row.tipo,
    precio: Number(row.precio),
    moneda: row.moneda || 'ARS',
    diaVencimiento: row.dia_vencimiento,
    activo: !!row.activo,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).getTime() : undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

export async function upsertBillingPaymentRow(p, organizationId) {
  if (!organizationId || !p?.id) return { error: new Error('invalid payment') };
  const uid = p.userId;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const row = {
    organization_id: organizationId,
    member_user_id: uid && uuidRe.test(String(uid)) ? uid : null,
    client_id: p.id,
    plan_id: p.planId || null,
    periodo: p.periodo || null,
    monto: Number(p.monto || 0),
    moneda: p.moneda || 'ARS',
    metodo: p.metodo || null,
    status: p.status || 'pendiente',
    pagado_parcial: p.pagadoParcial != null ? Number(p.pagadoParcial) : 0,
    paid_at: p.paidAt ? new Date(p.paidAt).toISOString() : null,
    last_partial_at: p.lastPartialAt ? new Date(p.lastPartialAt).toISOString() : null,
    refund_at: p.refundAt ? new Date(p.refundAt).toISOString() : null,
    refund_amount: p.refundAmount != null ? Number(p.refundAmount) : null,
  };
  return supabase.from('billing_payments').upsert(row, { onConflict: 'organization_id,client_id' });
}

export async function upsertBillingSubscriptionRow(s, organizationId) {
  if (!organizationId || !s?.id) return { error: new Error('invalid subscription') };
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const uid = s.userId;
  const row = {
    organization_id: organizationId,
    member_user_id: uid && uuidRe.test(String(uid)) ? uid : null,
    client_id: s.id,
    plan_id: s.planId || null,
    tipo: s.tipo || 'mensual',
    precio: Number(s.precio || 0),
    moneda: s.moneda || 'ARS',
    dia_vencimiento: Number(s.diaVencimiento || 5),
    activo: s.activo !== false,
    cancelled_at: s.cancelledAt ? new Date(s.cancelledAt).toISOString() : null,
  };
  return supabase.from('billing_subscriptions').upsert(row, { onConflict: 'organization_id,client_id' });
}

export async function fetchBillingPaymentsForOrg(organizationId) {
  if (!organizationId) return { data: [], error: null };
  return supabase
    .from('billing_payments')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(5000);
}

export async function fetchBillingSubscriptionsForOrg(organizationId) {
  if (!organizationId) return { data: [], error: null };
  return supabase
    .from('billing_subscriptions')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(2000);
}
