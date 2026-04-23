# Integraciones: analytics, export y Stripe (notas técnicas)

## Export CSV (5.6–5.8)

- **Miembros:** desde **Admin → Miembros** el ícono de descarga genera `miembros.csv` (UTF-8 con BOM en web) o copia al portapapeles en nativo.
- **Otras tablas:** mismo patrón (query staff + armado CSV en cliente o RPC que devuelva `text`); evitar secretos en la app.

## Google Analytics / tags (5.8)

- Guardar **Measurement ID** (`G-XXXX`) en configuración de org (`features.ga_measurement_id`) cuando se defina el flujo web; inyectar script solo en build web público.
- No bloquea app móvil.

## Zapier / webhooks genéricos

- Exponer URL firmada o con **secret** en header desde Edge Functions cuando haya un caso de uso concreto (ej. alta de socio → CRM).

## Stripe (5.5)

1. **Connect:** `organizations.stripe_connect_account_id` + toggle `stripe_checkout_enabled` (UI en **Admin → Stripe**).
2. **Checkout server-side:** Edge Function con `STRIPE_SECRET_KEY` (nunca en el cliente).
3. **Webhooks:** ruta tipo `https://<project>.supabase.co/functions/v1/stripe-webhook` con `STRIPE_WEBHOOK_SECRET`; validar firma y actualizar estado de pago en tablas propias cuando existan.

Hasta cablear Edge + claves, el panel solo persiste ids/flags para no bloquear el resto del producto.
