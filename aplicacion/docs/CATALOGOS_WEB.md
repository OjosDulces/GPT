# Páginas de productos · Control Emprende 4.3

Cada negocio dispone de una página pública dentro de la misma plataforma. No necesita comprar un dominio propio. El enlace toma el origen donde se aloja la aplicación y añade `/catalogo/nombre-del-negocio`. Por ejemplo, si la aplicación se aloja en una dirección del proveedor, los catálogos utilizan esa misma dirección. El nombre del negocio debe ser único dentro de la plataforma.

No se ha publicado un sitio ni conectado Supabase en esta entrega. La función está implementada, compilada y validada localmente. Los archivos incluyen el backend necesario y las instrucciones para activarlo. La dirección ilustrativa no representa una página ya disponible.

## Para el dueño del negocio

1. Carga nombres, fotos, precios y categorías desde **Productos → Catálogo**. La nueva **Descripción para la página pública** está pensada para materiales, medidas y características; no uses notas internas allí.
2. Entra en **Mi página web**. Define el nombre visible, la dirección, la frase principal y la presentación.
3. Escoge uno de los cuatro colores y la portada Editorial o Simple. El estilo público es independiente del modo oscuro de tu app.
4. Agrega, si quieres, WhatsApp con código de país, zona y horario. Solo se publican los datos que escribas aquí; no se copia el correo de tu cuenta.
5. Marca los productos que quieres mostrar y decide si se ven sus precios. Puedes guardar un borrador y usar **Vista previa**.
6. Con la app conectada y alojada en Internet, pulsa **Publicar página**. Copia el enlace para compartirlo en redes o con tus clientes.
7. **Guardar cambios** actualiza una página publicada. **Retirar página** deja de servir el catálogo en nuevas consultas. Cambiar su dirección invalida el enlace anterior.

Las fotos, precios, categorías y descripciones de los productos seleccionados se toman de los registros actuales. Se ven al abrir o recargar el catálogo, sin volver a publicarlo. Los productos nuevos no se agregan automáticamente. Los archivados o eliminados dejan de mostrarse. El primer producto seleccionado según el orden de Productos aparece en la portada Editorial.

El visitante puede buscar, filtrar por categoría y consultar por WhatsApp. Ese botón abre un mensaje preparado que la persona decide si envía. No crea un pedido, no descuenta stock ni cobra. El negocio acuerda pago y entrega directamente con el cliente; esta vitrina no requiere integrar Transbank.

## Activación técnica

- Instalación nueva: `setup.sql`, 003, 004, 005 y **006_public_catalogs.sql**, en ese orden.
- Si ya instalaste 4.2 correctamente: aplica únicamente **006_public_catalogs.sql** y reemplaza el frontend por la compilación 4.3.
- Configura la URL y clave pública de Supabase en `publicacion-directa/config.js`. Nunca uses la clave `service_role` en la web.
- Aloja `publicacion-directa/` en HTTPS. Todas las rutas `/catalogo/*` deben resolver `index.html`, igual que `/app`. Se incluye `_redirects` para alojamiento compatible.
- `config.js` se excluye de la precaché PWA; las llamadas a Supabase usan red. El catálogo no almacena una copia pública offline.
- Prueba con dos negocios reales y una ventana sin sesión: borrador, publicación, cambios de precio, producto archivado y retiro.

No hace falta crear un proyecto Supabase, una cuenta de alojamiento o un buzón de correo por cliente. Los límites de almacenamiento y tráfico se comparten entre los negocios de la plataforma. No se promete alojamiento gratuito ilimitado.

## Protección de datos

La tabla `business_catalogs` no tiene acceso directo para los roles del navegador. Las funciones de lectura y escritura privadas verifican al propietario. La dirección es única y el guardado usa versión para evitar sobrescribir cambios de otra sesión.

La función pública devuelve exclusivamente presentación, moneda y productos seleccionados activos: identificador, nombre, categoría, descripción pública, foto y precio visible. Nunca devuelve clientes, movimientos, costos, márgenes, recetas, existencias exactas ni el perfil privado. Cuando los precios están ocultos, el campo público vale `null`.

El visitante utiliza un cliente anónimo sin sesión persistente. No consulta las tablas internas ni necesita registrarse. Los textos se renderizan como texto, y las imágenes admiten HTTPS o datos JPEG, PNG y WebP; no se aceptan SVG ni direcciones ejecutables.

## Alcance y operación

- La funcionalidad no exige plan de pago en esta versión. Se mantiene el límite de productos del plan de la app; el catálogo admite hasta 500 seleccionados.
- La vista pública necesita JavaScript. No incluye generación de páginas estáticas, metadatos sociales específicos por negocio ni garantía de posicionamiento en buscadores.
- Las imágenes reutilizan el almacenamiento actual de los productos. La función pública omite imágenes de más de 500.000 caracteres y formatos no admitidos. Revisa la vista previa y vuelve a cargar una foto más liviana si no aparece.
- Las imágenes integradas en JSON consumen espacio de base de datos y transferencia por cada visita. Antes de ofrecer catálogos grandes o campañas con mucho tráfico, conviene pasar a archivos optimizados en almacenamiento de objetos y medir el consumo. No se realizó prueba de carga masiva.
- Los respaldos JSON existentes del negocio no incluyen `business_catalogs`. El respaldo completo de PostgreSQL debe conservar esta tabla. No se añadió soporte de edición pública sin conexión ni venta por carrito.
- La demo web permite guardar el diseño local y ver la página; el botón de publicación permanece deshabilitado. No se genera ningún instalador nuevo.

## Validación reproducible

`tests/catalog.test.js` verifica el aislamiento en PostgreSQL embebido (PGlite), validaciones, idempotencia de instalación, versiones, direcciones únicas, proyección pública, precios ocultos, actualización y retiro.

`npm run test:catalog-ui` usa la compilación de producción y Chromium con respuestas HTTP simuladas para las cuentas: editor, borrador, publicación, búsqueda, categorías, WhatsApp, conflictos, retiro, errores, persistencia local, fotos y descripción. Comprueba 1440, 768, 390 y 320 px. No sustituye una prueba con tu proyecto Supabase real.

Capturas en `docs/capturas/`; resultados en `CATALOGO_QA.json` y `PRUEBAS_4.3.txt`.
