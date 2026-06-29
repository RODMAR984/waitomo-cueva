/** Base URL pública donde MP/Stripe redirigen al socio tras pagar (debe ser un deploy Vercel activo). */
export function resolveCheckoutBackUrlBase(): string {
  const raw =
    Deno.env.get("CHECKOUT_BACK_URL_BASE") ||
    Deno.env.get("FITENGINE_WEB_APP_URL") ||
    Deno.env.get("FITENGINE_LINKS_BASE_URL") ||
    "https://fitengine.app";
  return String(raw).replace(/\/$/, "");
}
