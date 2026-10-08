# Control Emprende 4.2 · lectura y movimiento
2 de octubre de 2026.

## Qué cambió
- Textos secundarios más grandes, tipografía de sistema, mayor contraste y espaciado consistente.
- Fechas de entrega legibles, cantidades con singular/plural y explicaciones más directas en el inicio.
- Entrada de páginas con opacidad y ventanas con un desplazamiento breve; transiciones de 120 a 180 ms.
- Gráficos financieros sin interpolación animada de valores; cálculos del inicio conservados mientras no cambian los datos.
- Texto grande, modo oscuro y reducción de movimiento por preferencia del usuario o del sistema.
- Corrección del foco y el bloqueo de desplazamiento al abrir ventanas, incluido el ajuste de un píxel observado en pantallas estrechas.

## Validación de esta edición
- 59 pruebas de lógica, datos, permisos, pagos, personalización y política de escritorio aprobadas.
- Compilaciones web, demo autónoma, página comercial y renderer de escritorio completadas.
- Chromium: 1440, 1280, 390 y 320 px, sin desbordamiento global ni desplazamiento horizontal de la cabecera al abrir el personalizador.
- Tipografía del resumen: etiquetas de 14 px en escritorio y 13 px en móvil; texto grande de 16 px; ayudas de 13 y 12 px respectivamente.
- Modo oscuro y reducción de movimiento comprobados.
- Personalización: logo, paleta, frase, tarjetas y accesos conservados; aislamiento entre negocios; cancelación y errores de almacenamiento comprobados.
- Electron en Linux: inicio, venta, descarga CSV, aislamiento, bloqueo de red de la demo y persistencia de datos y estilo al cerrar y abrir.

Medición local de producción durante apertura de ventanas, cambio de pestañas y navegación: 98 intervalos muestreados, mediana 16.7 ms, percentil 95 33.2 ms, 0 intervalos y 0 tareas superiores a 50 ms. Resultado detallado: LECTURA_Y_MOVIMIENTO_QA.json. Esta medición usa los negocios de ejemplo y no garantiza el mismo rendimiento en todo equipo ni con grandes volúmenes de datos.

Las capturas de comprobación visual desactivan las animaciones únicamente al tomar la imagen, para mostrar el estado final. El muestreo de movimiento se hace en una página nueva, con animaciones activas.

## Windows y planes
El instalador 4.2 se entrega por separado para Windows 10 o posterior, x64. Sigue siendo una demo local. **No se probó la instalación, actualización ni desinstalación en Windows real y el instalador no tiene firma digital de editor.**

Se recomienda un único ejecutable comercial con funciones habilitadas por el plan de cada negocio. La edición de escritorio conectada, las cuentas y el desbloqueo de pago todavía requieren integración y validación real. Consulta MODELO_GRATIS_PRO.md y WINDOWS.md.

El bloqueo temporal de la comprobación visual ya fue resuelto; este documento sustituye la nota del avance en revisión.

## Repetir las comprobaciones de interfaz

```bash
npm run build
QA_PREVIEW=1 npm run test:polish
npm run test:personalization
npm run build:desktop:web
npm run test:desktop-ui
```

En PowerShell usa `$env:QA_PREVIEW="1"` antes de `npm run test:polish`. En Linux sin escritorio, la prueba nativa requiere `xvfb-run -a npm run test:desktop-ui`.
