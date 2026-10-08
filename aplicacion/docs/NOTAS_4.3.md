# Control Emprende 4.3 · Páginas públicas por negocio

3 de octubre de 2026.

Se incorporó Mi página web, el editor visual, la selección de productos, la descripción pública de cada producto y la ruta /catalogo/<nombre>. La migración 006 agrega publicación controlada por el propietario y lectura anónima con campos explícitos. No se creó ni recompiló un instalador de Windows.

Validación: 68 pruebas automatizadas aprobadas; compilaciones web y demo web completadas; recorrido Chromium sobre producción a 1440, 768, 390 y 320 px, sin errores de JavaScript ni desbordamiento horizontal. Se verificaron borrador, publicación, búsqueda, categorías, enlaces WhatsApp, precios ocultos, conflictos, retiro, reintento, persistencia local, imágenes, descripciones y modo oscuro. El catálogo mantiene su propio estilo en la vista previa.

Las pruebas de interfaz simulan HTTP de Supabase. Las pruebas de aislamiento ejecutan SQL en PostgreSQL embebido. No se desplegó la aplicación ni se probaron credenciales reales. La publicación necesita el alojamiento y la configuración del proyecto del propietario de la plataforma.

Se excluyó config.js de la precaché PWA para evitar configuraciones antiguas después de actualizar. El resto de funciones y la edición de escritorio 4.2 quedan conservados.

Consulta CATALOGOS_WEB.md para uso, instalación y límites de esta versión.
