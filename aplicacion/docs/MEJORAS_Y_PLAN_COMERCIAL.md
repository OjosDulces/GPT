# Producto integrado y planes · 3.0

Esta entrega evoluciona la base 2.0 en un único proyecto. La página comercial, la aplicación, los análisis, las suscripciones y el soporte comparten componentes y reglas; no son prototipos separados.

## Alcance entregado

| Área | Implementado | Activación necesaria |
| --- | --- | --- |
| Comercial | Landing responsive, planes, FAQ, demo y acceso | Alojamiento HTTPS para la versión pública |
| Gestión | Ventas, abonos, pedidos, clientes, productos/servicios, gastos, stock, producción y cotizaciones | Supabase para datos reales y sincronización |
| Incorporación | Asistente de tres pasos, moneda, actividad, inventario y meta | Cuenta conectada; ejemplo vacío disponible en demo |
| Análisis | Alertas explicadas, indicador, comparación de ventanas y cobertura de stock | Registros suficientes; las reglas funcionan localmente |
| Informes | Día, siete días, mes, descarga CSV e historial semanal | Programador para generar el historial automático |
| Importación | XLSX/CSV, primera hoja, vista previa, duplicados y rechazo de errores | Ningún proveedor adicional |
| IA | Endpoint Responses, métricas agregadas, consentimiento y cuota | Credenciales/modelo OpenAI y plan habilitado |
| Cobros | Webpay, comprobación en servidor, períodos e historial | Comercio Transbank, funciones y pruebas reales |
| Correo | Informe semanal opcional al propietario verificado | Resend, remitente, secretos y programación |
| Soporte | Ayuda buscable, tickets, historial y respuestas internas | Operador designado y funciones SQL instaladas |
| Operación | Indicadores de uso/planes, errores optativos, acceso privado | Cuenta añadida a platform_admins desde el servidor |
| Seguridad de datos | RLS, roles, invitaciones, auditoría, versiones y operaciones atómicas | Configuración y aceptación en Supabase real |

## Planes incluidos

Precios propuestos en CLP por negocio. La definición central está en `supabase/functions/_shared/plans.js`; los límites SQL correspondientes están en 004. Al cambiar precios/cuotas, actualiza ambos y las condiciones visibles de forma coordinada.

| Plan | Precio / 30 días | Nuevas ventas / mes UTC | Productos o servicios | Usuarios totales | IA y automático semanal |
| --- | ---: | ---: | ---: | ---: | --- |
| Gratis | $0 | 50 | 30 | 1 | No |
| Emprendedor | $4.990 | 500 | 500 | 1 | No |
| Inteligente | $9.990 | 2.000 | 2.000 | 1 | Sí |
| Negocio | $19.990 | 10.000 | 5.000 | 5 | Sí |

Una prueba de 14 días habilita Inteligente desde la creación del negocio, sin tarjeta. Son períodos de acceso con renovación manual, no cargos recurrentes. IA está limitada a 50 intentos diarios por negocio. Los cupos de ventas cuentan nuevos registros guardados, incluidas importaciones/restauraciones que agreguen identificadores; no son un límite de dinero vendido. El contador comienza con la instalación de 004 y no factura ni reclasifica ventas históricas.

El vencimiento conserva todos los datos. El propietario sigue consultando y registrando pagos. Las altas de productos se bloquean cuando sobrepasan el mayor entre el cupo vigente y la cantidad heredada; se permite corregir el catálogo existente. Los colaboradores conservan lectura y necesitan Negocio vigente para escribir. Borrar ventas no devuelve cuota del mes.

Los controles comerciales obligatorios son cuotas, miembros, acceso a IA y proceso semanal. Las herramientas locales de gestión, importación e informes no tienen bloqueos artificiales adicionales por plan; las listas comerciales destacan capacidades, no una separación exhaustiva de pantallas.

## Cómo interpreta los números

- Ventas: importe final de ventas válidas en el período, con descuento y entrega registrados.
- Cobrado: abonos fechados en el período, aunque la venta sea anterior. No se inventan fechas para saldos históricos.
- Flujo registrado: cobros fechados menos gastos pagados. No es saldo bancario ni efectivo disponible.
- Resultado estimado: ventas menos costo de lo vendido y gastos operativos del período. Las compras de inventario se consideran en caja y se excluyen del gasto operativo para evitar descontar dos veces el mismo costo. Registra correctamente la categoría de la compra.
- Por cobrar/pagar: saldos de los registros actuales; en un informe histórico no son una reconstrucción del balance a esa fecha.
- Indicador: 100 menos penalizaciones visibles por señales detectadas. Se exige historial mínimo. No es un modelo crediticio, una predicción de insolvencia ni una garantía.
- Cobertura: stock dividido por demanda media diaria, incluyendo días sin ventas. Requiere 14 días observados y tres fechas con ventas del producto; supone demanda constante y ninguna reposición.
- Tendencia: comparación de dos ventanas completas de 30 días con historial suficiente. No atribuye causas ni corrige estacionalidad.

Los costos incompletos se señalan; el margen puede estar sobrevalorado. «Cobro vencido» requiere una fecha de vencimiento de pago explícita. Una entrega atrasada no convierte por sí sola un saldo en moroso.

## Límites de esta edición

La entrega no incluye un sitio ya publicado, credenciales ni servicios comerciales contratados. Tampoco incluye facturación tributaria, integración bancaria, deuda/flujo predictivo basado en saldos bancarios, benchmarking externo, programa de referidos, mensajes automáticos por WhatsApp, cobro recurrente con tarjeta, Mercado Pago/Stripe o el backend del catálogo público heredado.

El acceso al catálogo antiguo se deja deshabilitado con `VITE_ENABLE_LEGACY_SHOP=false`; su código heredado no se ofrece como una tienda multinegocio operativa. No habilites ese recorrido sin completar su backend y aislamiento. No se realizan envíos a clientes desde el asesor.

## Operación para un lanzamiento

Los tickets necesitan una persona responsable y un procedimiento de cobros/reembolsos. Verifica tu comercio, dominio, correo, textos de privacidad, respaldo y recuperación. Mide primero el uso con negocios de prueba y datos representativos. El panel mide negocios con datos actualizados en 30 días; no mide sesiones ni presencia en tiempo real. Su facturación muestra pagos registrados de Webpay, sin cálculo de impuestos, devoluciones ni costos del proveedor.

La estructura JSON por negocio simplifica este MVP. Antes de usarlo a gran escala, mide tamaño/latencia y migra a tablas normalizadas y trabajos en cola si esos límites lo requieren. No se ha afirmado escalabilidad empresarial ni realizado una auditoría externa.
