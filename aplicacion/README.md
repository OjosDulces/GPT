# Control Emprende 4.3.1 · Edición local para Windows

Aplicación de escritorio con negocio vacío, datos propios y almacenamiento local persistente. Consulta `../LEEME_ENTREGA.md` para instalar, compilar y publicar la página comercial de descarga.

```bash
npm ci
npm ci --prefix desktop
npm test
npm run build:windows
```

El instalador se genera en `desktop/release/Control-Emprende-4.3.1-Windows-x64-Instalador.exe`.

La web entregada está en `../sitio`; solo presenta el producto y permite descargar el instalador. Las fuentes conservan componentes de versiones web anteriores, pero no se publican como demostración en la web de esta entrega.

Validación: `npm run test:desktop-renderer`, `npm run test:home-sections` y `npm run test:desktop-ui`. Los dos primeros usan Chromium. La prueba nativa necesita instalar el runtime con `npm --prefix desktop run runtime:install` y disponer de una sesión gráfica.
