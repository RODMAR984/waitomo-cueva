FitEngine — archivos para el dominio fitengine.app (invitaciones /join)
=======================================================================

Subí estos archivos en el hosting HTTPS de fitengine.app (no en Squarespace
si ese dominio solo está "aparcado": necesitás que https://fitengine.app sirva
contenido o al menos estas rutas).

Rutas obligatorias (mismo origen que el navegador abriría):
  https://fitengine.app/.well-known/apple-app-site-association
  https://fitengine.app/.well-known/assetlinks.json

Antes de subir:
  1) apple-app-site-association: reemplazá XXXXXXXXXX por tu Apple Team ID
     (developer.apple.com → Membership) y dejá el bundle
     com.waitomofitengine.cueva si no cambiás el id de la app.
  2) assetlinks.json: reemplazá REPLACE_SHA256... por el SHA-256 del keystore
     de release (EAS: eas credentials -p android, o Play Console → App signing).

Content-Type: application/json (sin .json en el nombre del archivo de Apple).

Tras desplegar: probá Universal Links en iOS y "adb" / verificación de enlaces
en Android según la doc de Expo (linking / android-app-links).
