# Control Emprende 4.4.0 · prueba de licencias y Mercado Pago

Esta edición conecta la aplicación Windows con el servidor de licencias de prueba. Incluye prueba de 15 días, solo lectura al vencer y compra manual de 30 días por $9.990 CLP. La activación depende de la confirmación del servidor.

**Todavía es una prueba de integración: usa únicamente cuentas y tarjetas de prueba de Mercado Pago. No distribuyas esta edición como producto con pagos reales.**

## Si aparece «Hay una compra pendiente de comprobar»

[Actualiza únicamente el código del Worker siguiendo esta guía](servidor-licencias/CONFIGURAR_EN_CLOUDFLARE.md#corrección-de-hay-una-compra-pendiente-de-comprobar). La revisión `cloudflare-fetch-2` corrige el fallo de conexión inmediato por una opción de red incompatible con Cloudflare, recupera órdenes sin enlace y muestra los rechazos HTTP de Mercado Pago. Se reprodujo el fallo anterior y se comprobó la corrección con workerd. No necesitas reinstalar la aplicación; conserva la base, los bindings y los secretos actuales. El código actualizado en GitHub debe desplegarse manualmente en Cloudflare.

## Descargar e instalar

1. [Descarga el ZIP completo de esta rama](https://github.com/OjosDulces/GPT/archive/refs/heads/prueba-licencias-4.4.0.zip).
2. Extrae **todo** el ZIP en una carpeta; no ejecutes archivos dentro de la vista del ZIP.
3. Abre **PREPARAR-INSTALADOR.cmd** y espera el mensaje **Listo**.
4. Abre **Control-Emprende-4.4.0-Windows-x64-Instalador.exe**.

Requiere Windows 10/11 de 64 bits. Si ya usas Control Emprende, exporta un respaldo y cierra la aplicación antes de actualizar. Se conserva la misma carpeta y base de datos local.

El preparador reúne los fragmentos de `descargas`, comprueba SHA-256 y genera el instalador original. No abre el instalador automáticamente. El ejecutable no tiene firma digital de editor; la instalación y desinstalación aún deben comprobarse en Windows real.

## Probar Mercado Pago

1. Abre la app con Internet. Debe indicar **Prueba: 15 días** y **Prueba de pagos**.
2. Pulsa **Mi licencia → Probar compra · $9.990 CLP**. Se abre Mercado Pago en el navegador.
3. Usa el **comprador de prueba**, distinto del vendedor, y una tarjeta de prueba de Mercado Pago Chile. Si el navegador tiene la sesión del vendedor, ciérrala antes de entrar con el comprador de prueba.
4. Termina la compra simulada. Vuelve a la app y pulsa **Comprobar licencia y pago**. También se comprueba al volver a la ventana y periódicamente después de abrir la compra.
5. Solo un pago confirmado debe mostrar **Acceso activo**. Un pago pendiente, rechazado o una simple visita a la página de regreso no concede días.

Los 30 días se suman al período vigente; si pagas el primer día de prueba, puedes ver aproximadamente 45 días disponibles. No es un cobro recurrente.

Si aparece un error, comparte el texto y una captura ocultando datos sensibles. Nunca compartas Access Token, secreto del webhook ni archivos de activación.

## Datos y licencia

- Empieza sin productos, clientes ni ventas ficticios. Los registros del negocio permanecen en tu equipo.
- Al vencer se permite consultar, exportar y descargar respaldos. Se bloquean escrituras, importaciones, restauraciones y guardado del diseño de catálogo.
- Necesitas Internet para la primera activación y para renovar la comprobación. Una licencia comprobada admite hasta siete días sin conexión, sin superar el vencimiento del acceso.
- Desinstalar y volver a instalar no reinicia la prueba. No borres manualmente la activación: el servidor conserva el registro del equipo y podría requerir recuperación asistida.
- Las versiones 4.3.1 y 4.3.2 ya distribuidas no se restringen de forma retroactiva. El control local de licencias no equivale a una protección imposible de modificar.

## Estado de la entrega

[Resultados y límites de las pruebas](pruebas/RESULTADOS_4.4.0.md). Se probaron el cliente y el servidor con respuestas de pago simuladas. Falta completar una compra con el entorno de pruebas real de Mercado Pago y validar Windows, incluido su almacenamiento seguro.

El instalador incluye únicamente la URL del Worker de pruebas y su clave **pública** Ed25519. Las credenciales de Mercado Pago y la clave privada permanecen en el servidor. No regeneres la clave del servidor sin preparar otra versión del instalador.

Esta rama no publica ni sustituye la web de Cloudflare. La web anterior permanece en la [rama de entrega 4.3.2](https://github.com/OjosDulces/GPT/tree/entrega-control-emprende-4.3.2). No subas este ZIP de fuentes e instalador como si fuera la carpeta del sitio.

## Desarrollo

Usa Node 24 o posterior. En `aplicacion`: `npm ci`, `npm test`, `npm run build:desktop:web`. En `aplicacion/desktop`: `npm ci`. En `aplicacion`: `npm run test:desktop-ui` (necesita escritorio o Xvfb en Linux), `npm run test:desktop-renderer` (Chromium), y `npm run build:windows`.

En `servidor-licencias`: `npm ci`, `npm run check`, `npm test`. Para Cloudflare, consulta [la guía del servidor](servidor-licencias/CONFIGURAR_EN_CLOUDFLARE.md). Las guías históricas dentro de `aplicacion/docs` describen ediciones anteriores; esta página explica la edición Windows 4.4.0.

Para pasar a cobros reales se requiere configurar y probar un servidor de producción, sus credenciales, webhook y clave pública; luego compilar otra entrega. Cambiar solo el token de este servidor de pruebas no convierte este instalador en producción.
