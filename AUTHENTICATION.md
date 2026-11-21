# Autenticación de FILLCUT

La aplicación sirve HTML, CSS y JavaScript estáticos. Firebase Authentication se carga como módulo desde el CDN oficial, con una versión fija. El optimizador y los PDF se ejecutan de manera independiente. Los visitantes siguen usando sus proyectos locales y la opción «Perfil local del navegador» conserva el acceso al nombre local.

## Configuración local

Con Node.js 22 o posterior, copia `.env.example` a `.env.local` y completa los valores públicos de Firebase Console → Configuración del proyecto → General → Tus apps → app web → Configuración del SDK.

| Variable | Campo de Firebase |
| --- | --- |
| `FIREBASE_API_KEY` | `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_APP_ID` | `appId` |
| `FIREBASE_APPLE_ENABLED` | Indicador de disponibilidad, `false` por defecto |

Ejecuta `node --env-file=.env.local scripts/configure-auth.mjs`. Esto genera `auth-config.json` en la raíz y en `dist/`. Ambos archivos se excluyen de Git. El archivo se sirve al navegador y solo acepta los campos públicos anteriores. El generador también acepta las variables del ambiente si se ejecuta sin `--env-file`.

Sirve `dist/` por HTTP para probar en local. Puedes usar `python3 -m http.server 8080 --directory dist` y abrir `http://localhost:8080`. Confirma que `.mjs` se sirva como JavaScript. Si falta la configuración o Firebase no responde, el optimizador sigue disponible y el modal permite reintentar o continuar como invitado.

## Firebase Console

- Confirma que Google y Correo electrónico/contraseña estén habilitados en Authentication → Método de acceso.
- Revisa Authentication → Configuración → Dominios autorizados. Autoriza `fillcut.com`, `www.fillcut.com` y solo los dominios que uses para validar, como `localhost`. Para que una sesión sobreviva al regreso desde otra URL, sirve la app en un solo dominio canónico. La persistencia local de Firebase está ligada al origen del navegador.
- Revisa las plantillas de verificación y recuperación. Prueba que los enlaces funcionen en una bandeja real y que el perfil refleje la verificación al recargar o pulsar «Actualizar estado de verificación».
- Mantén Apple deshabilitado en la interfaz hasta verificar Service ID, Team ID, Key ID, clave privada y URL de retorno en Firebase y Apple Developer. Activa el indicador únicamente después de probar Apple con una compilación privada. La clave privada se configura en Firebase y no pertenece al código, al archivo de entorno ni al JSON público.
- Ejecuta las pruebas con cuentas de prueba. Comprueba Google en navegadores de escritorio y móviles, registro, inicio con correo, recuperación y persistencia al cerrar y reabrir el navegador. Si el navegador bloquea el popup, el modal muestra el error y permite reintentar.

## Publicación posterior

1. Revisa la rama con respecto a la versión que está desplegada en Hostinger. El repositorio de GitHub debe contener la base actual de FILLCUT antes de integrar esta actualización.
2. Genera el JSON con la configuración del ambiente objetivo. Inclúyelo en el paquete estático de `dist/` o genéralo durante la compilación de Hostinger. Desplegar solo los archivos registrados en Git deja el acceso a cuentas desactivado.
3. Valida el paquete en un entorno privado con HTTPS, incluido el acceso de invitado, el plano de corte y el PDF para proveedores.
4. Después de autorizar la publicación, integra en la rama de producción y despliega mediante el flujo existente. Comprueba el acceso en el dominio canónico y conserva el paquete anterior para revertir.

## Extensiones futuras

La UI consume la identidad a través de `firebase-auth.mjs`. El invitado carece de usuario Firebase y cada cuenta registrada tiene un UID estable. Una integración futura puede asociar proyectos a ese UID mediante un backend autenticado. La autorización PRO deberá provenir de una membresía comprobada en el backend, con un token de Firebase validado en el servidor. El plan PRO y el almacenamiento en la nube quedan fuera de esta versión.
