# Control Emprende para Windows · 4.2.0

## Instalar y probar

1. Descarga `Control-Emprende-4.2.0-Windows-x64-Instalador.exe` en un PC con Windows 10 o posterior, de 64 bits.
2. Abre el instalador, revisa la información de la edición y elige la carpeta. Se instala para el usuario actual.
3. Abre **Control Emprende** desde el escritorio o el menú Inicio. No necesitas Node, Chrome ni conexión para recorrer la demo.
4. Elige un negocio de ejemplo, registra una venta y prueba **Hazlo tuyo**.
5. Cierra y vuelve a abrir el programa para comprobar el guardado. Exporta un respaldo desde Ajustes antes de hacer pruebas de restauración.

El archivo incorpora el programa completo; no descarga la aplicación al instalar. Los accesos directos y la entrada de desinstalación se crean para el usuario de Windows que lo instala.

## Alcance de esta edición

Es una **demostración local de escritorio** con los mismos negocios ficticios y funciones de prueba de la edición web. Las ventas, pruebas y preferencias se conservan en este PC. No incluye cuentas conectadas, sincronización con el celular, cobros, correos ni asesor en línea. El asesor local funciona con los registros de la demo.

Los cambios hechos en la demo del navegador y en el programa de Windows son independientes. La carpeta de datos de Windows es `%APPDATA%\ControlEmprende`. No edites sus archivos manualmente; usa respaldos desde la aplicación. Reiniciar demo recupera los datos del ejemplo seleccionado.

El menú de Windows permite copiar, pegar, ajustar el zoom, abrir la carpeta de descargas y consultar la versión. Los enlaces HTTPS externos, como WhatsApp, piden confirmación y se abren en el navegador. No envían mensajes automáticamente.

## Actualizar y desinstalar

Cierra el programa antes de instalar una nueva edición en la misma carpeta. Las actualizaciones son manuales; no hay actualización automática. La ubicación de datos permanece estable entre versiones.

Puedes desinstalar desde Configuración de Windows → Aplicaciones. El desinstalador elimina los archivos del programa y accesos directos; conserva los datos de prueba y no elimina otros archivos que hayas puesto en la carpeta de instalación. Para retirar también tus datos, exporta primero un respaldo y elimina manualmente la carpeta de datos indicada arriba.

## Estado de validación

Se compiló un ejecutable real de Windows x64 y un instalador NSIS con desinstalador incorporado. Se probó la aplicación en Electron sobre Linux con pantalla virtual: inicio, venta, exportación CSV, restricciones de navegación/red y persistencia de datos y estilo tras cerrar y abrir. Se revisó visualmente la interfaz.

**Todavía no se ejecutó la instalación, actualización ni desinstalación en Windows real.** Esa validación es necesaria antes de distribuirlo a clientes. El instalador no está firmado con un certificado digital de editor; no se presenta como una distribución comercial firmada.

## Generar otra versión desde el código

Se requiere Node.js 24 o posterior e Internet para instalar las herramientas de compilación.

```bash
npm ci
npm ci --prefix desktop
npm run build:windows
```

El resultado está en `desktop/release/Control-Emprende-4.2.0-Windows-x64-Instalador.exe`. La carpeta `desktop/release/win-unpacked` contiene el programa sin instalar. No copies únicamente su `.exe`: necesita los archivos que lo acompañan. El instalador sí se distribuye como un solo archivo.

`desktop/build-windows.cjs` empaqueta Electron y compila `desktop/resources/installer.nsi` con NSIS. Genera una lista de los archivos propios para el desinstalador y evita borrar carpetas ajenas de forma recursiva. El icono y los metadatos pertenecen a Control Emprende. Las dependencias están fijadas en `desktop/package-lock.json`.

Para probar la interfaz nativa desde el código:

```bash
npm run build:desktop:web
npm run test:desktop
npm run test:desktop-ui
```

En Linux se requiere una sesión gráfica o `xvfb-run -a npm run test:desktop-ui`. Las pruebas usan una carpeta temporal separada. La configuración que desactiva el sandbox al ejecutar tests como root en Linux está limitada al script de pruebas; la aplicación distribuida conserva su renderer aislado.

Para una versión conectada será necesario preparar su inicio de sesión, enlaces de confirmación/recuperación y sincronización con el servicio real. Esa integración no se activa agregando credenciales a esta demo: su red está limitada intencionalmente a recursos locales.
