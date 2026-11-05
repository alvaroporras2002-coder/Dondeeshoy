# ¿Dónde es hoy?

Una agenda de planes en Costa Rica, con diseño adaptable a celular y escritorio, ubicación GPS, filtros, favoritos, ruleta de planes, publicación de eventos y grupos para salir con tus compas.

## Abrir el proyecto

La aplicación empieza en **`index.html`**, en minúsculas.

La interfaz usa HTML, CSS y módulos JavaScript sin paquetes de terceros. Servila desde un sitio HTTPS o un servidor local; abrir el archivo directamente con `file://` puede bloquear los módulos, el GPS y el portapapeles.

## Dos formas de usarla

| Entorno | Eventos y grupos |
| --- | --- |
| Sitio con Worker y base D1 | Publicaciones compartidas y grupos persistentes entre navegadores. Cada navegador puede confirmar una sola plaza por grupo. |
| GitHub Pages o servidor estático | Exploración de la agenda de muestra, filtros, favoritos, GPS y ruleta. Los borradores y las listas manuales de grupo se guardan solo en ese navegador; la interfaz distingue la prueba local de las confirmaciones compartidas. |

Los eventos iniciales son **ilustrativos**: no son una programación oficial de los lugares mencionados. Sus coordenadas son puntos aproximados de zonas, y sus precios y promociones no están confirmados. Las fotografías promocionales se generaron con IA y no representan establecimientos ni eventos reales.

## Grupos y promoción

El concepto es **vos + 4 compas**. La persona que crea el grupo ocupa la primera plaza. Cuatro confirmaciones desde sesiones diferentes completan las otras plazas y habilitan el estado de beneficio propuesto del 50% para quien organizó el grupo. Salir de un grupo vuelve a calcular ese estado.

No se emiten entradas, cupones de pago ni comprobantes de SINPE. La promoción necesita aceptación y validación del local. Una sesión de navegador no acredita identidad, compra ni asistencia; antes de canjear descuentos comerciales se requiere verificación de compras, controles antifraude y condiciones del organizador. Los eventos gratuitos o sin participación en la promoción no admiten este beneficio.

## Publicación de eventos

El formulario recopila nombre, lugar, zona, categoría, fecha, hora, precio en colones, descripción, coordenadas y una imagen opcional. Acepta fotos JPG, PNG o WebP de hasta 8 MB y las redimensiona y comprime en el navegador antes de enviarlas; el servidor acepta imágenes optimizadas de hasta 500 KB. En el sitio con servidor se guardan en D1 y aparecen como publicaciones de comunidad **sin verificar**. No se recopilan correos, teléfonos ni datos de pago.

Los nombres de participantes y el nombre de quien organiza el grupo se muestran a quienes abran el enlace del grupo. El GPS de búsqueda se procesa en el navegador para calcular distancias y no se envía al servidor. Las coordenadas indicadas al publicar un evento sí se guardan y muestran como ubicación del local. Las sesiones de participación usan una cookie aleatoria `HttpOnly`, `Secure` y `SameSite=Lax`; la base conserva únicamente su hash.

## Verificación y compilación

Se requiere Node.js 24 o posterior para ejecutar las pruebas con SQLite incluido:

```bash
npm test
npm run build
```

La compilación no instala dependencias. Produce `dist/server/index.js`, un Worker ESM con la API y los recursos de interfaz e imágenes integrados. La configuración de publicación está en `.openai/hosting.json`; usa el enlace D1 `DB`. Las migraciones de esquema están en `drizzle/`, con su diario de migraciones.

Las pruebas verifican validaciones, publicación persistente, protección de origen, sesiones, duplicados, cupo máximo, elegibilidad de eventos, salida del grupo y errores de guardado. No sustituyen una revisión visual en navegadores y dispositivos reales.

## Publicar en Cloudflare por cuenta propia

1. Autenticá Wrangler con tu cuenta: `npx wrangler login`.
2. Creá la base: `npx wrangler d1 create dondeeshoy`.
3. Copiá su `database_id` real a `wrangler.jsonc`, reemplazando el identificador de ejemplo.
4. Aplicá las migraciones: `npx wrangler d1 migrations apply DB --remote`.
5. Ejecutá `npm run deploy:cloudflare`.

Para probar la base local: `npm run db:migrate:local`, `npm run build` y `npx wrangler dev`. La base local y la publicada son independientes. No se deben volver a ejecutar manualmente migraciones que ya se hayan aplicado.

## Publicar la versión estática en GitHub Pages

En GitHub, abrí **Settings → Pages → Deploy from a branch**, elegí la rama que contiene el nuevo `index.html` y la carpeta `/ (root)`. La versión estática no incluye ejecución de la API. Para tener publicaciones y grupos compartidos, usá el despliegue con Worker y D1.

## Archivos principales

- `index.html`, `styles.css`, `app.js`: interfaz y comportamiento.
- `data.js`: agenda de ejemplo y categorías.
- `assets/`: fotografías optimizadas e identidad visual.
- `worker/api.js`: API D1 y validación del servidor.
- `db/schema.ts`, `drizzle/`: esquema de datos y migración inicial.
- `scripts/build.mjs`: empaquetado del Worker sin dependencias.
- `tests/backend.test.mjs`: pruebas de comportamiento con SQLite real.

Generated with [Codex](https://openai.com/codex/).
