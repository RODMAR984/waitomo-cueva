# Automatizar cobros (linkear cuenta)

**Para dejar todo listo y linkear en un día:** ver **[LINKEAR-CUENTA-UN-DIA.md](./LINKEAR-CUENTA-UN-DIA.md)**.

---

## Por qué hoy es manual

- La caja y los movimientos se guardan **solo en el celular** (AsyncStorage).
- No hay ningún servidor que reciba avisos de Mercado Pago, banco o billetera.
- Por eso cada pago (QR, transferencia, Cuenta DNI, etc.) se carga a mano en **Caja → Registrar ingreso**.

## Cómo automatizarlo (linkear una cuenta)

La idea: cuando alguien te paga, **el proveedor (Mercado Pago, etc.) avisa a tu backend** y el backend registra el ingreso. La app solo muestra lo que ya quedó cargado.

### 1. Mercado Pago (QR / link / Cuenta DNI)

- Mercado Pago envía **webhooks** cuando hay un pago aprobado.
- Necesitás:
  - Una **URL pública HTTPS** (no puede ser solo el celular).
  - Un **backend** que reciba el POST del webhook, valide que venga de MP y guarde el pago.

Pasos típicos:

1. En [Tus integraciones de Mercado Pago](https://www.mercadopago.com.ar/developers), configurar la URL de notificaciones (webhook) apuntando a tu servidor.
2. En ese servidor (por ejemplo una **Supabase Edge Function** o un pequeño API en un VPS):
   - Recibir el POST.
   - Verificar la firma/secret de MP.
   - Leer el `payment_id`, consultar el detalle del pago con la API de MP (monto, estado, etc.).
   - Si está aprobado, **guardar un registro de “ingreso”** en una tabla (por ejemplo en Supabase: `ledger` o `payments`).
3. En la app: en lugar de leer solo de AsyncStorage, **sincronizar** con esa tabla de Supabase (al abrir Finanzas o en tiempo real con Realtime). Así los cobros por MP aparecen solos.

Documentación útil:

- [Notificaciones de pago - Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications)
- [Webhooks - Mercado Pago](https://www.mercadopago.com.ar/developers/en/docs/wallet-connect/additional-content/your-integrations/notifications/webhooks)

### 2. Cuenta bancaria / transferencias

- La mayoría de bancos en Argentina **no** dan APIs simples para “me llegó una transferencia” a cuentas personales/PyMEs.
- Opciones:
  - Usar un **agregador** o banca que sí tenga API/webhooks (si existe oferta para tu banco).
  - Seguir registrando transferencias a mano y usar automatización solo para MP (QR / link / Cuenta DNI).

### 3. Cambios necesarios en la app

Para que la automatización se vea en la app:

1. **Persistir finanzas en Supabase**: crear tablas (por ejemplo `ledger`, `caja_inicial`) y que el backend que recibe el webhook escriba ahí.
2. **Sincronizar en la app**: que la pantalla de Caja lea de Supabase (y opcionalmente siga permitiendo movimientos locales o los unifique).
3. **Seguridad**: el endpoint del webhook debe validar que el POST viene de Mercado Pago (secret/firma) y no exponer datos sensibles.

Resumen: **sí hay manera de automatizar** linkeando una cuenta (sobre todo Mercado Pago vía webhooks + backend). La parte “conectar cuenta” en la app sería luego solo la UI para configurar esa conexión; el trabajo fuerte es el backend que recibe las notificaciones y escribe en tu base de datos.
