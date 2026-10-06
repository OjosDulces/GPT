# Descargar Control Emprende 4.3.1

Esta rama contiene la entrega de la aplicación y el sitio. Para descargar todo desde GitHub, pulsa **Code → Download ZIP**.

## Obtener el instalador en Windows

1. Descarga el ZIP de esta rama y **extrae todo su contenido** en una carpeta.
2. Dentro de esa carpeta, abre **PREPARAR-INSTALADOR.cmd**. No lo ejecutes desde la vista del ZIP sin extraer.
3. Espera el mensaje **Listo**. Aparecerá **Control-Emprende-4.3.1-Windows-x64-Instalador.exe** en la misma carpeta.
4. Abre el `.exe` para instalar la aplicación en Windows 10 u 11 de 64 bits.

El preparador usa las herramientas incluidas en Windows, funciona sin Internet, comprueba SHA-256 y no instala ni abre la aplicación automáticamente. El ejecutable se almacena en varios fragmentos porque supera el límite de un archivo de GitHub; el resultado es el instalador original completo.

**Estado:** instalador sin firma digital. La compilación y los datos de descarga se verificaron en Linux; tanto la instalación como el preparador `.cmd` necesitan validación en Windows. No se cambian políticas de ejecución ni protecciones de Windows.

## Sitio y fuentes

- `sitio/`: carpeta lista para subir a Cloudflare Pages. Contiene la web de presentación y la descarga del instalador; no ofrece una demo web. Sube la carpeta completa, con `index.html` en la raíz del despliegue.
- `Control_Emprende_4.3.1_Fuentes.zip`: fuentes de la aplicación, scripts y pruebas.
- `LEEME_ENTREGA.md`: cambios, funcionamiento local y compilación.
- `FIRMA_DIGITAL_CHILE.md`: estado y pasos pendientes para contratar la firma.

La aplicación empieza vacía para usar datos propios. El inicio separa Resumen, Accesos rápidos y Seguimiento, con tarjetas y grupos visibles en tema claro y oscuro.

Esta entrega en GitHub no actualiza la página pública de Cloudflare. El flujo Next.js existente pertenece al repositorio original y no se usa para desplegar este paquete.
