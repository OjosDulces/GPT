# Validación de Control Emprende 4.4.0

Entorno: Linux, Node 24, Chromium y Electron 44.5.1. Fecha: 8 de octubre de 2026. Los pagos se simularon localmente; no se usaron credenciales ni tarjetas reales.

- **79 pruebas de aplicación aprobadas**, incluidas 10 de licencia: firma, equipo y ambiente, plazo de prueba, persistencia sin reiniciar el plazo, vencimiento, período sin conexión, retroceso del reloj, recuperación al corregir una fecha adelantada, archivo dañado y almacenamiento seguro no disponible.
- **14 pruebas del servidor aprobadas**: precio fijo, prueba de 15 días, compra de 30 días, firma del webhook, comercio/moneda/modo/monto, pago pendiente, activación, repetición sin duplicar días, recuperación de notificaciones y revocación por devolución. También pasó la comprobación de tipos del Worker para Cloudflare.
- **Electron nativo en Linux**: arranque vacío, productos y clientes propios, importación, venta y descuento de stock, diseño local, respaldo/restauración y persistencia al reiniciar. Se confirmó bloqueo de escrituras y restauración al vencer, respaldo disponible, apertura de la URL de prueba, ninguna activación por abrir el checkout, habilitación al recibir una licencia firmada activa y reinicio sin conexión con autorización vigente. El renderer no dispone de Node ni acceso a Internet.
- **Interfaz en Chromium**: mismo flujo de datos propios, conflicto concurrente, rechazo de datos inválidos, conservación de datos corruptos sin reemplazarlos, sin errores JavaScript ni solicitudes externas.
- **10 vistas del inicio**: agrupaciones y espacios entre secciones, temas claro/oscuro, anchos de 320 a 1440 px sin desbordamiento.
- **18 vistas del indicador**: sin puntuación, 0 y 100; ambos temas; 320, 390 y 1440 px. Contraste mínimo 4.5:1 y texto dentro del círculo.

El arnés nativo utiliza un servidor HTTP local que firma respuestas con una clave temporal. Solo en desarrollo, con rutas de prueba explícitas, se sustituye la identificación de Windows y el almacenamiento DPAPI. Ese modo está deshabilitado en la aplicación empaquetada. Estas pruebas no validan el Registro ni el cifrado de Windows.

## Lo que queda por comprobar fuera de este entorno

1. Instalación, actualización, preparador CMD, identificación del equipo, cifrado DPAPI y desinstalación en Windows real.
2. Pago aprobado, pendiente y rechazado contra el entorno de pruebas real de Mercado Pago, con sus cuentas de prueba; webhook y activación del Worker desplegado. El entorno de trabajo no pudo consultar directamente el dominio del Worker (bloqueo HTTP 403); la clave pública fue facilitada por el usuario.
3. Configuración y prueba de producción antes de cobrar o distribuir a clientes. Esta entrega permanece en `mode: test`.

La publicación en GitHub no despliega el sitio ni cambia las variables del Worker. El instalador no lleva certificado de firma de código. La firma Ed25519 de las licencias es independiente y sí se comprueba en el cliente.

## Artefacto generado

Instalador NSIS completo: `Control-Emprende-4.4.0-Windows-x64-Instalador.exe`, 105773751 bytes. Los siete fragmentos se reunieron y compararon byte a byte con el ejecutable original. Se verificaron el manifiesto y el preparador CMD. El contenido ASAR coincide con el código probado y la clave pública suministrada; no incluye credenciales, estado de activación ni arneses de prueba.

SHA-256: `5b97badca7d1c6c95648df28fa04d14127b4c2c651b201ed3e2d9b6b68247c2b`.
