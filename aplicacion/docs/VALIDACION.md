# Validación de entrega · 02/10/2026

## Resultado local

**59 pruebas automatizadas aprobadas, 0 fallos.** Además pasaron los tres recorridos de interfaz en Chromium con vistas de escritorio y móvil, y la generación de web, demo autónoma y página comercial autónoma.

Entorno: Node 24.19.0, React 19, Vite 8, Playwright 1.62.1 y PostgreSQL embebido PGlite 0.5.8. Los números 003/004/005 corresponden al orden de las migraciones entregadas. Se verificó repetición de 003 antes de envolver el guardado, y de 004/005 sobre el estado final.

| Área | Evidencia |
| --- | --- |
| Dominio | Stock agregado, servicios sin stock, compras ponderadas, producción sin cambios parciales, caja por fecha, respaldo y CSV seguros |
| Almacenamiento | Una RPC por operación, conflicto sin sobrescritura, sin escrituras offline, sin caché tras rechazo de permisos, resultado incierto exige recarga |
| Base de datos | Aislamiento por negocio, roles, auditoría, atomicidad, invitaciones y prohibición de modificación directa |
| Análisis | Historial mínimo, días sin ventas, zonas horarias, fechas desconocidas, canceladas/futuras, deuda vs. entrega y costo de inventario |
| Importación | Comillas/multilínea, duplicados, valores inválidos, fórmulas y servicios sin stock |
| Producto | Prueba, cuotas, reversión completa al exceder límite, abonos coherentes, seis monedas, operador y tickets |
| Servicios | IA con consentimiento/cuota, activación de pago única y reserva de correo sin repetición |
| Pago con simulación | Estado/monto/orden/sesión, autorización, monto incorrecto, cancelación sin confirmar cargo, timeout seguido de consulta, retorno repetido y rechazo al no propietario |
| Interfaz principal | Venta y stock, compras con líneas repetidas, gasto pendiente/pago, formulario ante fallo, negocios/monedas y móvil |
| Interfaz del producto | Landing, asesor, CSV de informe, importación CSV/XLSX, validación/persistencia, meta, ticket de demo, onboarding y pago deshabilitado |
| Personalización | Paleta, tema, logo, frase, orden de tarjetas y accesos persistentes; separación entre negocios; registros intactos; Escape descarta; errores de logo y almacenamiento visibles |
| Contraste de color | Normalización de preferencias, colores personalizados legibles y rechazo de formatos no admitidos |
| Presentación | Vistas móvil/escritorio sin desbordamiento global, menú móvil y enlaces locales comercial → demo |

La sintaxis de las seis funciones/módulos TypeScript de servidor se comprobó con el eliminador de tipos de Node. Los tests de handlers usan dependencias simuladas. **No se ejecutaron funciones en Deno/Supabase real ni transacciones, respuestas OpenAI o correos reales.** No se dispuso de las credenciales correspondientes.

## Reproducir

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:ui
npm run test:product-ui
npm run test:personalization
```

Si ya tienes Chromium instalado, puedes indicar `CHROMIUM_PATH` y `CHROMIUM_ARGS` a los scripts. Las capturas se guardan en `docs/capturas/`. Los datos utilizados son ficticios.

Vite avisa de un fragmento grande de la aplicación. La compilación termina correctamente; conviene medir la carga en una red móvil real antes de optimizar por rutas. La advertencia de Node sobre eliminación experimental de tipos pertenece al test de funciones.

## Aceptación pendiente en las cuentas reales

1. **Auth:** alta, confirmación, inicio, recuperación, caducidad, cierre de sesión y enlaces del dominio final.
2. **Aislamiento:** dos cuentas, varios negocios, invitación caducada/rotada, retirada de permisos; comprobar que un tercero no consulta ni modifica registros por API.
3. **Concurrencia:** dos pestañas guardan desde la misma versión; comprobar que una recibe conflicto y no pierde la información guardada por la otra.
4. **Operación:** venta con descuento/entrega/abono, compra duplicada, producción sin materiales, anulación, corrección y restauración de respaldo.
5. **Webpay integración:** aprobación, rechazo, cancelación, timeout, regreso repetido y estado pendiente. Confirmar importe, orden, negocio, plan y exactamente un período. Después de habilitar el comercio, validar producción de forma controlada.
6. **IA:** propietario autoriza/revoca; usuario de otro negocio rechazado; plan/cuota aplicados; modelo devuelve respuesta y falla de forma visible cuando no está disponible.
7. **Informe y correo:** tarea autenticada, una semana por negocio, zona horaria, repetición sin duplicado, consentimiento, correo verificado, desactivación y revisión de envíos inciertos. Comprobar entrega real y remitente.
8. **Soporte:** usuario crea ticket; solo operador asignado ve/responde desde el panel; la respuesta aparece en el negocio correcto.
9. **Móvil/PWA:** HTTPS, instalación, actualización, reconexión, descarga de exportaciones, acceso por teclado y lector de pantalla. Los recorridos automatizados no sustituyen una auditoría completa de accesibilidad ni una prueba en teléfonos físicos.
10. **Operación del servicio:** restauración de servidor, límites de ejecución del proceso semanal, logs, carga representativa, reglas HTTP/CSP, documentos comerciales y responsables de atención.

No se ejecutó una prueba de penetración, auditoría independiente ni carga de alta concurrencia. La validación local demuestra los casos descritos y no certifica el despliegue todavía inexistente.

## Edición de escritorio 4.1

Se generó un instalador de Windows con NSIS y se probó el renderer en Electron sobre Linux con pantalla virtual. El recorrido verificó inicio, ventas, descarga CSV y persistencia de datos y personalización al cerrar y abrir. También se comprobaron las rutas permitidas del protocolo local y el bloqueo de protocolos externos ejecutables. No se ejecutó el instalador en Windows ni se dispone de certificado digital del editor. Consulta `WINDOWS.md`.

## Lectura y movimiento 4.2

Se repitieron las 59 pruebas, el recorrido de personalización y el recorrido nativo de Electron sobre la edición 4.2. La comprobación visual de producción pasó a 1440, 1280, 390 y 320 px, con texto grande, modo oscuro y movimiento reducido. El desplazamiento horizontal al abrir el personalizador fue corregido. Consulta `NOTAS_4.2.md` y `LECTURA_Y_MOVIMIENTO_QA.json` para métricas y límites.
