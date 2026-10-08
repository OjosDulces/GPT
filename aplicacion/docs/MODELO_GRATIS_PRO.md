# Un ejecutable para Gratis y planes de pago

## Decisión recomendada
Distribuir una sola aplicación de Windows. El cliente crea su cuenta o inicia sesión, elige su negocio y el servidor determina qué funciones tiene disponibles. Al contratar un plan, el mismo programa habilita las funciones correspondientes después de confirmar el pago; no requiere otro instalador.

“Pro” se usa aquí como nombre general para los planes de pago. El proyecto conserva sus nombres actuales: Gratis, Emprendedor, Inteligente y Negocio. No se modifican precios ni límites con esta propuesta.

## Qué ya existe en el código
La edición web tiene cuentas, pertenencia a negocios y una suscripción asociada a cada negocio. La base de datos calcula el plan efectivo según el período pagado o la prueba, y vuelve a Gratis al finalizar la vigencia. También controla límites de ventas, productos e integrantes, permisos y acceso al asesor en línea.

El pago debe ser confirmado por el backend antes de modificar la suscripción. Un mensaje de éxito en pantalla o una preferencia guardada en el PC no acreditan una compra.

## Qué aún falta
El ejecutable actual es una demo local con datos ficticios. No tiene inicio de sesión conectado, sincronización ni desbloqueo real de los planes de pago.

Para convertirlo en el producto comercial hay que:
- Preparar una edición de escritorio conectada al servicio real y los flujos de confirmación de cuenta y recuperación de acceso.
- Consultar el plan al iniciar sesión, cambiar de negocio y volver de un pago.
- Validar en el servidor todas las operaciones y funciones restringidas por plan.
- Definir qué puede hacerse sin conexión y cómo informar el estado de sincronización.
- Probar suscripción, vencimiento, renovación y cambio de plan con cuentas de prueba.
- Firmar y validar la distribución de Windows antes del lanzamiento comercial.

La compra actual prevista en el proyecto habilita un período de servicio; no debe publicitarse como renovación automática mientras no se implemente y pruebe ese mecanismo.

## Experiencia propuesta
Sin cuenta: recorrido de demostración.
Con cuenta y plan Gratis: trabajo real dentro de sus límites.
Con suscripción vigente: funciones y límites del plan contratado.
Al vencer: regreso a Gratis, conservando la información; el producto debe explicar cualquier límite que impida seguir agregando registros.

El plan pertenece al negocio. Los integrantes acceden con sus propias cuentas y permisos. No se concede acceso a un negocio por compartir el instalador ni por pagar una suscripción de otro negocio.

## Dos pagos distintos
Los cobros que cada emprendimiento recibe de sus clientes siguen usando los medios que ese negocio elija. Tu cobro por la suscripción de Control Emprende es una operación separada.

El cliente no necesita contratar Transbank solo para probar la aplicación. La integración que tú elijas para vender suscripciones se configura en tu servicio comercial, con sus credenciales y validación de pagos.

