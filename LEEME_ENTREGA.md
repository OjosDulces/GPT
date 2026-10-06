# Control Emprende 4.3.1 · Windows y página de descarga

Esta entrega reemplaza la prueba HTML por una aplicación instalable y permite evaluar con datos propios. La web presenta el producto y descarga el instalador; no ejecuta la aplicación.

## Qué cambió

- Instalador completo `.exe` para Windows 10 y 11 de 64 bits.
- Primer inicio con un negocio vacío y asistente para nombre, actividad, moneda e inventario. No hay productos, clientes, ventas ni metas ficticias precargadas.
- Datos propios en una base local de la aplicación. No se mezclan con las antiguas demostraciones ni se añade un botón de reinicio de datos.
- Importación CSV/XLSX, registros manuales, ventas, informes y exportación/restauración de respaldos.
- Inicio dividido en Resumen del negocio, Accesos rápidos y Seguimiento. Fondos suaves, bordes visibles y encabezados de tarjetas, también en tema claro. Menú lateral separado en Día a día, Mi negocio, Análisis y herramientas y Configuración.
- Sin cuotas o suscripciones ficticias, tickets de soporte simulados ni opciones activables de IA/correo que no funcionen en esta edición.
- Corregido el rechazo de producción por precisión decimal y el nombre de archivo del respaldo. La actividad «Productos y servicios» también completa el asistente correctamente.

No se implementó una licencia con vencimiento ni sincronización en la nube. Esta edición no exige tarjeta ni cuenta. La página distingue los servicios locales de los servicios conectados que aún no se habilitan.

## Instalar

Abre `Control-Emprende-4.3.1-Windows-x64-Instalador.exe` en Windows de 64 bits. El asistente instala el programa para el usuario actual y crea accesos directos. El archivo contiene la aplicación completa; no requiere Node ni descargar componentes durante la instalación.

La información se conserva en los datos de la aplicación de Windows, bajo `%APPDATA%\ControlEmprende`. Las operaciones nuevas utilizan una base IndexedDB separada de las claves de las demostraciones anteriores. Desinstalar conserva esa carpeta. Para trasladar registros, exporta desde **Ajustes → Datos y respaldo** y restaura el JSON en una instalación configurada con la misma moneda.

Los respaldos de operaciones no incluyen la personalización visual ni el diseño local del catálogo. La restauración solicita confirmación y descarga una copia del estado anterior. La versión mantiene un negocio local por usuario de Windows.

El ejecutable todavía no tiene firma digital del editor. Se generó el instalador de Windows y se comprobó su contenido, pero la instalación, actualización y desinstalación deben probarse en un Windows real antes de distribuirlo de forma general. No se ha desactivado la protección del programa distribuido.

## Actualizar Cloudflare Pages

`Control_Emprende_4.3.1_Cloudflare_Pages.zip` contiene exclusivamente el sitio listo para desplegar, con `index.html` en la raíz.

1. Abre tu proyecto `control-emprende` en Cloudflare Pages.
2. Descomprime el ZIP. Crea un nuevo despliegue mediante la carga de archivos y sube la carpeta que contiene `index.html`, conservando `assets` y `descargas`. Cada archivo está por debajo de 25 MiB.
3. Comprueba en el nuevo despliegue que se descarga `Control-Emprende-4.3.1-Windows-x64-Instalador.exe` y que `/prueba.html` redirige a la descarga.

No subas únicamente el `.exe` como archivo de Pages: supera el límite de tamaño por archivo. El sitio aloja partes de hasta 16 MiB, las descarga y verifica con SHA-256, y entrega al visitante un solo `.exe`. Si la descarga falla, se cancela o un archivo está alterado, no entrega un ejecutable parcial. El proceso requiere JavaScript y HTTPS (Cloudflare Pages ya sirve HTTPS).

No contiene `prueba.html` ni el antiguo ZIP de HTML. `_redirects` redirige esas direcciones antiguas a la sección de descarga. `_headers` define la política de contenido y evita que los metadatos de versión queden obsoletos en caché.

La URL pública no fue modificada en esta sesión. Su lectura estaba bloqueada por la red del entorno; las comprobaciones se hicieron sobre el paquete adjunto y el sitio nuevo servido localmente. Un resultado local no acredita que Cloudflare haya recibido o publicado los archivos.

## Compilar desde las fuentes

El ZIP de fuentes conserva las carpetas `aplicacion`, `sitio`, `scripts` y `pruebas` bajo una misma raíz. Las partes grandes del instalador se regeneran y no están en el ZIP de fuentes.

Requiere Node 24 o superior:

```bash
cd aplicacion
npm ci
npm ci --prefix desktop
npm test
npm run build:windows
cd ..
node scripts/prepare-release.mjs
```

El instalador queda en `aplicacion/desktop/release` y se copia a la raíz de la entrega. `prepare-release.mjs` genera las partes y `sitio/descargas/version.json`, con tamaños y hashes reales. No edites el manifiesto a mano para cambiar la versión; regenera la distribución.

Para probar la interfaz compilada, disponer de Chromium y ejecutar desde `aplicacion`:

```bash
CHROMIUM_PATH=/ruta/a/chromium npm run test:desktop-renderer
CHROMIUM_PATH=/ruta/a/chromium npm run test:home-sections
```

Para pruebas nativas, instala el runtime de Electron con `npm --prefix desktop run runtime:install` y ejecuta `npm run test:desktop-ui`. En Linux se necesita una sesión gráfica o Xvfb. En redes con proxy, el instalador del runtime puede necesitar `NODE_USE_ENV_PROXY=1`.

Para verificar la descarga del sitio, después de preparar el release, ejecuta desde la raíz:

```bash
CHROMIUM_PATH=/ruta/a/chromium node scripts/test-site.mjs
```

Los resultados y capturas están en `pruebas`. Los datos usados por las pruebas son temporales y no se incluyen en el instalador.
