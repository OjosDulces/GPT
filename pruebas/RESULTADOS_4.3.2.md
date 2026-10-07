# Corrección del indicador del asesor · 4.3.2

## Error reproducido

El texto del indicador heredaba el color claro del tema oscuro, mientras el círculo conservaba un fondo claro fijo. La prueba sobre 4.3.1 falló con contraste 1,04:1. La etiqueta original también era demasiado pequeña.

## Corrección

El fondo y los dos textos usan ahora los colores del tema. Se amplía el círculo a 104 px y la etiqueta a 11 px. El encabezado se adapta al ancho disponible y se corrige el desbordamiento de los paneles del asesor a 320 px. El cálculo del puntaje no cambia: sin historial suficiente muestra «— / Aprendiendo», sin inventar un porcentaje.

## Validación

- Prueba de regresión: 18 combinaciones (0, 100 y sin puntaje; claro/oscuro; 320, 390 y 1440 px).
- Contraste mínimo observado en ambos textos: 5.76:1, por encima de 4,5:1.
- Ningún texto queda fuera del círculo; sin desbordamiento horizontal ni errores JavaScript en esos escenarios.
- Compilación del programa y generación del instalador 4.3.2 completas.
- La descarga y los casos de error se registran en `test-site-4.3.2.log`; los hashes y el archivo de la versión están en `release-4.3.2.log`.

Las pruebas de esta corrección se ejecutaron en Chromium sobre la aplicación compilada. No se ejecutó la instalación en Windows. El instalador sigue sin firma digital. Los registros de 4.3.1 se conservan como antecedentes y no representan nuevas ejecuciones en 4.3.2.
