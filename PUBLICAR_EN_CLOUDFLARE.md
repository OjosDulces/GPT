# Publicar la descarga correcta en Cloudflare Pages

La actualización está en esta rama de GitHub. Como el proyecto de Cloudflare se publica manualmente, es necesario cargar la carpeta del sitio para actualizar `control-emprende.pages.dev`.

## Pasos

1. En esta rama, pulsa **Code → Download ZIP** y extrae TODO el ZIP en tu computador.
2. Abre la carpeta extraída. Encontrarás una carpeta llamada **sitio**.
3. En Cloudflare, abre **Workers & Pages → control-emprende** y crea un nuevo despliegue de **producción** mediante carga de archivos.
4. Sube la carpeta **sitio** completa. La raíz del despliegue debe contener `index.html`, `main.js`, `styles.css`, `404.html`, `_headers`, `_redirects`, `assets/` y `descargas/`.
5. Espera a que el despliegue de producción termine correctamente. Abre la URL pública y recarga con **Ctrl + F5**.

Sube el contenido de `sitio`, no la carpeta superior `GPT-entrega-control-emprende-4.3.2` ni el ZIP de fuentes. Tampoco uses el paquete antiguo `Control_Emprende_Cloudflare_Pages.zip`. Todos los archivos de la carpeta nueva están por debajo del límite de 25 MiB de Pages. El instalador se entrega como un solo `.exe` al visitante.

## Comprobar que quedó publicado

- La página debe mostrar **Descargar para Windows**, sin botones para probar una aplicación en línea.
- En `https://control-emprende.pages.dev/descargas/version.json` deben aparecer `"version": "4.3.2"` y `"file": "Control-Emprende-4.3.2-Windows-x64-Instalador.exe"`. Si muestra la portada HTML, el despliegue o su carpeta raíz siguen siendo incorrectos.
- En la sección de descarga debe figurar versión **4.3.2**, formato **.exe** y aproximadamente **101 MB**.
- Al descargar debe guardarse **Control-Emprende-4.3.2-Windows-x64-Instalador.exe**, de **105775633 bytes**. No debe guardarse un archivo HTML.
- `/prueba.html` lleva a la sección de descarga. No abre una nueva aplicación web ni vuelve a abrir pestañas sucesivas.

El botón verifica tamaño y SHA-256 antes de entregar el archivo. Si recibe una página HTML en lugar del instalador, muestra un error y no entrega una descarga falsa.

## Diagnóstico del archivo recibido

El archivo `uppuY1hO.htm` enviado por el usuario contiene exactamente los mismos bytes que el `index.html` del paquete web antiguo (14348 bytes). Sus botones siguen apuntando a `/prueba.html` y `/descargas/Control_Emprende_Prueba_4.3.zip`. Esto acredita que lo descargado fue la portada antigua. Una ruta inexistente que devuelve la portada es compatible con el comportamiento observado; no se pudo inspeccionar la configuración remota porque la red del entorno bloqueó la URL pública.

La carpeta `sitio` de esta entrega ya incluye el flujo correcto, un `404.html` explícito y las redirecciones de las rutas anteriores. Las pruebas son locales y no acreditan que se haya efectuado la carga manual a Cloudflare.
