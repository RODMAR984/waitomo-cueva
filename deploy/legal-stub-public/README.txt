Legal (borrador) — uso opcional para la web pública
==================================================

En la app, privacidad y términos ya están como pantallas internas (texto en locales).

Estas páginas HTML son un "plan B" por si en tiendas (Google Play / App Store) o en
marketing te piden URLs HTTPS públicas:

1. Subí privacidad.html, terminos.html y **auth-callback.html** a tu hosting (ej. la misma carpeta que
   waitomofitengine.com en Vercel/Netlify/cPanel). La ruta pública debe ser exactamente
   /auth/callback (muchos hosts mapean auth-callback.html → /auth/callback; si no, configurá rewrite).
2. En app.json podés apuntar fitenginePrivacyUrl y fitengineTermsUrl a esas URLs.

No sustituyen asesoría legal: revisá el contenido con un profesional antes de
un lanzamiento masivo.
