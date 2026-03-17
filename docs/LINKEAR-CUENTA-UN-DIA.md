# Linkear cuenta (Mercado Pago) en un día

Todo el backend y la app ya están preparados. Cuando quieras conectar Mercado Pago para que los cobros se carguen solos, seguí estos pasos.

## 1. Ejecutar la migración en Supabase

En el **SQL Editor** de tu proyecto Supabase:

1. Abrí el archivo `supabase/migrations/20250227000000_finanzas_ledger_caja.sql`.
2. Copiá todo el contenido y pegálo en una nueva query.
3. Ejecutá (Run).

Con eso quedan creadas las tablas `finanzas_ledger` y `finanzas_caja_inicial` con RLS.

## 2. Desplegar la Edge Function del webhook

En la terminal, desde la raíz del proyecto:

```bash
npx supabase functions deploy mercadopago-webhook
```

(Asumiendo que tenés el CLI de Supabase y que el proyecto está linkeado. Si no: `npx supabase link --project-ref <tu-ref>`.)

La URL de la función quedará algo así:

`https://<tu-ref>.supabase.co/functions/v1/mercadopago-webhook`

## 3. Configurar secrets en Supabase

En el dashboard de Supabase: **Project Settings → Edge Functions → Secrets** (o vía CLI):

- **MP_ACCESS_TOKEN**: Access Token de Mercado Pago (Producción o Pruebas). Lo sacás de [Tus integraciones → Credenciales](https://www.mercadopago.com.ar/developers/panel).
- **FINANZAS_OWNER_ID**: UUID del usuario que “es dueño” de la caja (el que ve Finanzas en la app). Es el `id` de la fila en `auth.users` (o el que ves en Supabase → Authentication → Users). Si solo hay un admin, copiá ese UUID.

Con el CLI:

```bash
npx supabase secrets set MP_ACCESS_TOKEN=APP_USR-xxx...
npx supabase secrets set FINANZAS_OWNER_ID=uuid-del-usuario-admin
```

## 4. Configurar el webhook en Mercado Pago

1. Entrá a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel) → Tu aplicación → **Webhooks** (o **Notificaciones**).
2. Configurá la URL de notificaciones con la URL de tu Edge Function:
   `https://<tu-ref>.supabase.co/functions/v1/mercadopago-webhook`
3. Eventos: activá **Pagos** (payment).
4. Guardá. Opcional: anotá la “clave secreta” si querés validar la firma después.

## 5. Probar

- Hacé un pago de prueba (QR, link o Cuenta DNI) con la cuenta de MP asociada a ese Access Token.
- Cuando el pago quede aprobado, Mercado Pago envía el POST al webhook.
- La Edge Function consulta el pago en la API de MP, lo registra en `finanzas_ledger` y la app (al abrir Finanzas o al sincronizar) muestra ese ingreso.

## Resumen de qué hace cada cosa

| Componente | Función |
|------------|--------|
| **Tablas** `finanzas_ledger` y `finanzas_caja_inicial` | Guardan movimientos y caja inicial; la app lee/escribe y el webhook escribe. |
| **Edge Function** `mercadopago-webhook` | Recibe el POST de MP, pide el detalle del pago a la API de MP e inserta un ingreso en `finanzas_ledger`. |
| **App** | Al iniciar (con usuario logueado) sincroniza ledger y caja inicial desde Supabase; cada movimiento o caja inicial que cargás en la app también se escribe en Supabase. |

Así, todo queda listo para que el día que quieras linkear la cuenta solo tengas que configurar token, owner id y URL del webhook.
