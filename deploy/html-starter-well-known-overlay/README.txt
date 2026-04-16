Archivos para repo html-starter (raíz: .well-known/ + vercel.json)

URLs canónicas (apex):
  https://fitengine.app/.well-known/apple-app-site-association
  https://fitengine.app/.well-known/assetlinks.json

Si el repo solo se veía bien en www, completá DNS (A @ en Vercel) para que
fitengine.app sirva el mismo sitio.

Único mantenimiento habitual: Apple Team ID en apple-app-site-association (appID).
Android: SHA-256 en assetlinks.json si cambiás keystore.
