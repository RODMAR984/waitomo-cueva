/** Defaults billing_currency + timezone IANA por país (ISO-3166 alpha-2). Fase internacional 1. */

const BY_COUNTRY = {
  AR: { currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires' },
  UY: { currency: 'UYU', timezone: 'America/Montevideo' },
  CL: { currency: 'CLP', timezone: 'America/Santiago' },
  MX: { currency: 'MXN', timezone: 'America/Mexico_City' },
  CO: { currency: 'COP', timezone: 'America/Bogota' },
  PE: { currency: 'PEN', timezone: 'America/Lima' },
  BR: { currency: 'BRL', timezone: 'America/Sao_Paulo' },
  US: { currency: 'USD', timezone: 'America/New_York' },
  ES: { currency: 'EUR', timezone: 'Europe/Madrid' },
  PT: { currency: 'EUR', timezone: 'Europe/Lisbon' },
  GB: { currency: 'GBP', timezone: 'Europe/London' },
};

export const TRIAL_SIGNUP_COUNTRIES = [
  { code: 'AR', labelKey: 'trial_country_ar' },
  { code: 'UY', labelKey: 'trial_country_uy' },
  { code: 'CL', labelKey: 'trial_country_cl' },
  { code: 'MX', labelKey: 'trial_country_mx' },
  { code: 'CO', labelKey: 'trial_country_co' },
  { code: 'PE', labelKey: 'trial_country_pe' },
  { code: 'BR', labelKey: 'trial_country_br' },
  { code: 'US', labelKey: 'trial_country_us' },
  { code: 'ES', labelKey: 'trial_country_es' },
  { code: 'PT', labelKey: 'trial_country_pt' },
  { code: 'GB', labelKey: 'trial_country_gb' },
  { code: 'OTHER', labelKey: 'trial_country_other' },
];

export function localeDefaultsForCountry(countryCode) {
  const code = String(countryCode || '').trim().toUpperCase();
  if (code === 'OTHER' || !code) {
    return { currency: 'USD', timezone: 'UTC' };
  }
  return BY_COUNTRY[code] || { currency: 'USD', timezone: 'UTC' };
}
