/**
 * Medios de pago que el gym muestra a sus socios (persistido en organizations.features.client_payment_methods).
 * Si falta la clave, todo queda habilitado (comportamiento anterior).
 */

export const DEFAULT_CLIENT_PAYMENT_COPY = {
  transfer_copy: 'Alias: waitomo.gym / CBU: 0000003100001234567890',
  dni_copy: 'Alias Cuenta DNI: waitomo.dni',
  modo_copy: 'Alias CVU: waitomo.billetera',
};

const DEFAULT_FLAGS = {
  mercadopago: true,
  transferencia: true,
  cuenta_dni: true,
  modo: true,
  efectivo: true,
};

/**
 * @param {Record<string, unknown>|null|undefined} features - organization.features
 * @returns {{
 *   mercadopago: boolean,
 *   transferencia: boolean,
 *   cuenta_dni: boolean,
 *   modo: boolean,
 *   efectivo: boolean,
 *   transfer_copy: string,
 *   dni_copy: string,
 *   modo_copy: string,
 * }}
 */
export function resolveClientPaymentMethods(features) {
  const raw = features?.client_payment_methods;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...DEFAULT_FLAGS,
      ...DEFAULT_CLIENT_PAYMENT_COPY,
    };
  }
  const trimOr = (v, fallback) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s || fallback;
  };
  return {
    mercadopago: raw.mercadopago !== false,
    transferencia: raw.transferencia !== false,
    cuenta_dni: raw.cuenta_dni !== false,
    modo: raw.modo !== false,
    efectivo: raw.efectivo !== false,
    transfer_copy: trimOr(raw.transfer_copy, DEFAULT_CLIENT_PAYMENT_COPY.transfer_copy),
    dni_copy: trimOr(raw.dni_copy, DEFAULT_CLIENT_PAYMENT_COPY.dni_copy),
    modo_copy: trimOr(raw.modo_copy, DEFAULT_CLIENT_PAYMENT_COPY.modo_copy),
  };
}
