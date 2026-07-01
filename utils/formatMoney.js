/** Formato de montos según moneda de la org (fase internacional). */

const ZERO_DECIMAL_CURRENCIES = new Set(['ARS', 'CLP', 'COP', 'UYU', 'JPY', 'KRW']);

const CURRENCY_LOCALE = {
  ARS: 'es-AR',
  USD: 'en-US',
  EUR: 'es-ES',
  GBP: 'en-GB',
  BRL: 'pt-BR',
  MXN: 'es-MX',
  CLP: 'es-CL',
  COP: 'es-CO',
  PEN: 'es-PE',
  UYU: 'es-UY',
};

/**
 * @param {string} [currency]
 * @param {string} [userLocale] es | en | pt
 */
export function localeForCurrency(currency, userLocale) {
  const c = String(currency || 'ARS').toUpperCase();
  if (userLocale === 'en') return 'en-US';
  if (userLocale === 'pt') return CURRENCY_LOCALE[c] === 'pt-BR' ? 'pt-BR' : 'pt-PT';
  return CURRENCY_LOCALE[c] || 'es-AR';
}

/**
 * @param {number|null|undefined} priceCents
 * @param {string} [currency]
 * @param {{ locale?: string, userLocale?: string }} [opts]
 */
export function formatMoneyFromCents(priceCents, currency = 'ARS', opts = {}) {
  if (priceCents == null) return null;
  return formatMoneyAmount(Number(priceCents) / 100, currency, opts);
}

/**
 * @param {number} amount unidades mayores (pesos, dólares, etc.)
 * @param {string} [currency]
 * @param {{ locale?: string, userLocale?: string, emptyLabel?: string }} [opts]
 */
export function formatMoneyAmount(amount, currency = 'ARS', opts = {}) {
  const c = String(currency || 'ARS').toUpperCase();
  const loc = opts.locale || localeForCurrency(c, opts.userLocale);
  const zeroDec = ZERO_DECIMAL_CURRENCIES.has(c);
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: c,
      maximumFractionDigits: zeroDec ? 0 : 2,
      minimumFractionDigits: zeroDec ? 0 : 2,
    }).format(amount);
  } catch {
    const n = zeroDec ? Math.round(amount) : Math.round(amount * 100) / 100;
    return `${c} ${n}`;
  }
}

/** Moneda de facturación de la org → código Stripe (lowercase). */
export function stripeCurrencyFromBilling(billingCurrency) {
  return String(billingCurrency || 'USD').trim().toLowerCase();
}
