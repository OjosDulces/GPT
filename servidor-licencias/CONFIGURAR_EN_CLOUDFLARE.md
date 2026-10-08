# Mercado Pago: servidor de licencias en ambiente de prueba

Este servicio corresponde a **15 días de prueba** y **$9.990 CLP por 30 días**, con renovación manual y activación automática al verificarse cada pago. No crea suscripciones ni cargos recurrentes.

## Estado real

El servicio pasó 24 pruebas automatizadas locales y tres comprobaciones en workerd 2026-10-08 con un proveedor simulado, sin red externa ni credenciales reales. El usuario desplegó el Worker de pruebas y confirmó `billingEnabled: true`; eso indica presencia de configuración, no un pago aprobado. La aplicación Windows 4.4.0 de esta rama consulta ese servidor y verifica las licencias. Falta probar una compra contra la cuenta real de pruebas de Mercado Pago y validar la instalación en Windows antes de distribuir comercialmente.

## Corrección de «Hay una compra pendiente de comprobar»

La revisión `payment-diagnostics-3` corrige además el error inmediato «Mercado Pago no respondió»: `workerd` no admite `redirect: error`. Se usa `manual` y se rechazan respuestas de redirección sin reenviar credenciales. La versión anterior reproduce el mensaje en el motor real; la nueva pasa esa prueba. También recupera intentos `created` sin enlace, conserva la misma referencia y no concede acceso por crear un checkout. Antes de recuperar consulta si ya hay un pago; si existe, bloquea otro enlace y permite comprobar el pago. Una consulta rechazada o malformada no se interpreta como ausencia de pagos. Se conserva la prueba y la clave de firma.

Para actualizar un Worker existente:

1. Abre `worker-listo.js` en GitHub y copia su contenido completo con el botón de copiar del archivo.
2. En Cloudflare → Workers & Pages → `control-emprende-licencias-test` → **Edit code**, reemplaza el contenido de `worker.js` y pulsa **Deploy**. Mantén los bindings y variables existentes.
3. Abre la URL del Worker terminada en `/health`. Debe aparecer `"revision":"payment-diagnostics-3"`.
4. En la app pulsa **Comprobar licencia y pago** y luego **Probar compra**. No necesitas otro instalador ni ejecutar SQL.

Si aparece `PUBLIC_BASE_URL`, revisa esa variable en Cloudflare: debe contener `https://control-emprende-licencias-test.carrascoaraya97.workers.dev`. Si aparece HTTP 401/403, Mercado Pago rechazó la consulta: revisa el Access Token del vendedor y el ambiente correspondiente directamente en Cloudflare, sin enviarlo por chat. Otros errores muestran la operación y el código HTTP; no se imprime la credencial ni el cuerpo de la respuesta del proveedor.

`billingEnabled: true` indica que hay variables configuradas; no valida que Mercado Pago las acepte. Esta corrección todavía debe desplegarse en el Worker del usuario y probarse contra Mercado Pago.

## Pago aprobado en Mercado Pago, pero licencia todavía en prueba

La revisión `payment-diagnostics-3` incorpora diagnósticos en los registros de Cloudflare. No elimina comprobaciones ni activa licencias por el regreso del navegador. Mantiene la recuperación de checkout y la corrección de red anteriores. El instalador 4.4.0 no necesita cambiar.

1. Reemplaza `worker.js` con `worker-listo.js` y pulsa **Deploy**, conservando bindings y variables.
2. En `/health` comprueba `"revision":"payment-diagnostics-3"`.
3. En Cloudflare abre el Worker → **Observability → Logs**. Si la interfaz ofrece vista en vivo, actívala.
4. En la app pulsa **Comprobar licencia y pago**. Vuelve a los registros, actualiza si hace falta, abre la petición `POST /status` y busca `license_payment_check`.
5. Comparte únicamente los campos `reason`, `matches` o las comprobaciones booleanas que aparecen en esos registros. No se registran tokens, claves, correos, objetos de pago completos ni datos del negocio.

| Registro | Qué demuestra |
| --- | --- |
| `payment_search` con `matches: 0` | La consulta del servidor no encontró un pago para la referencia de la orden. |
| `payment_mode_mismatch` | El modo que informa el pago no coincide con el modo configurado. Hay que revisar credenciales/flujo; este registro no autoriza cambiar a producción. |
| `merchant_mismatch` | El pago corresponde a otra cuenta vendedora. |
| `missing_order_reference` / `order_not_found` | El pago no se pudo asociar a una orden de esta base. |
| `payment_not_approved` | La respuesta consultada al proveedor todavía no confirma aprobación. |
| `approved_validation_failed` | El pago dice aprobado pero falla importe, moneda o devolución; las banderas indican qué comprobación falló. |
| `payment_check_error` | Hubo un error de consulta; `message` contiene un mensaje saneado, no el cuerpo del proveedor. |
| `payment_applied` | El servidor verificó y aplicó el pago. Si la app sigue en prueba, hay que revisar la recepción de la licencia. |

Las pruebas pasan localmente y en workerd con proveedor simulado. El motivo del pago del usuario sigue pendiente de observar en el Worker desplegado. No se marca una orden como pagada mediante SQL para ocultar el problema.

## 1. Crear un Worker separado del sitio

1. En Cloudflare abre **Workers & Pages** y busca la opción de crear un **Worker**.
2. Puedes empezar con el ejemplo Hello World y llamarlo **control-emprende-licencias-test**. Los nombres de los botones pueden variar.
3. Abre el editor de código del Worker. Sustituye el código de ejemplo por TODO el contenido de **worker-listo.js** de esta carpeta y guarda/despliega.
4. Guarda la URL `https://...workers.dev` que Cloudflare asigne. Es pública y puede compartirse. No uses la URL del sitio `control-emprende.pages.dev` para este servidor.

El archivo listo para pegar se genera desde `src/policy.mjs` y `src/worker.mjs`; no contiene claves de tu cuenta. No requiere paquetes ni compilación para pegarlo en el editor. Habrá rutas no disponibles hasta completar la base y la configuración siguientes.

## 2. Crear y vincular D1

1. En la sección de almacenamiento de Cloudflare, crea una base **D1** llamada **control-emprende-licencias-test**.
2. Abre la consola SQL de esa base nueva. Ejecuta el contenido completo de **migrations/0001_licencias.sql**. No contiene órdenes para borrar tablas.
3. Regresa al Worker y agrega un enlace o binding de tipo **D1 database**, con nombre de variable **DB**, seleccionando la base recién creada.
4. Guarda y despliega los cambios que solicite Cloudflare.

La base guarda identificadores de licencia, fechas y referencias de pago; no recibe productos, clientes ni ventas del negocio. También contiene la clave privada que firma las autorizaciones de uso: conserva el acceso a esta base y sus respaldos solo para administradores. Esta firma interna no es un certificado de editor de Windows ni requiere comprar uno.

## 3. Variables y secretos del Worker

En la configuración del **Worker nuevo**, busca Variables y secretos o Variables and Secrets. Configura:

| Nombre | Tipo | Valor |
|---|---|---|
| `PAYMENT_MODE` | Texto | `test` |
| `ENABLE_PRODUCTION_PAYMENTS` | Texto | `false` |
| `PUBLIC_BASE_URL` | Texto | La URL HTTPS exacta de este Worker, sin rutas ni parámetros |
| `MP_ACCESS_TOKEN` | **Secret** | El Access Token de prueba de la integración Checkout Pro |

El Access Token se pega directamente en Cloudflare y se guarda como Secret. No lo pongas en el código, GitHub, la página web, el instalador ni el chat. La Public Key de Mercado Pago no es necesaria para este flujo de creación de preferencias en servidor.

## 4. Configurar las notificaciones de Mercado Pago

1. En la aplicación Control-emprende de Mercado Pago, entra a **Webhooks**.
2. Selecciona el ambiente de **prueba** y la URL `https://TU-WORKER.workers.dev/webhooks/mercadopago`.
3. Selecciona el evento de **Pagos** y guarda.
4. Copia la clave secreta de firma que muestre Mercado Pago y guárdala en el Worker como un segundo **Secret**, de nombre **MP_WEBHOOK_SECRET**. No la compartas por el chat.
5. Guarda/despliega la configuración del Worker.

El servidor consulta el pago en Mercado Pago antes de conceder acceso. Un parámetro `status=approved` en el navegador no activa la licencia. Una notificación duplicada tampoco añade otro período.

## 5. Verificación sin exponer claves

- Abre `https://TU-WORKER.workers.dev/health`: debe mostrar `mode: "test"`, `trialDays: 15`, `priceCLP: 9990`, `periodDays: 30` y, una vez guardados ambos secretos, `billingEnabled: true`.
- Abre `https://TU-WORKER.workers.dev/public-key`: debe mostrar los campos `kty`, `crv` y `x`. Esta es la clave **pública del servidor de licencias**, diferente de la Public Key de Mercado Pago; no debe aparecer un campo `d`.
- Puedes compartir la URL del Worker y esas respuestas públicas. Que `billingEnabled` sea true solo confirma la presencia de configuración: no acredita todavía que Mercado Pago acepte las credenciales.

La URL y clave pública de pruebas ya están integradas en el instalador 4.4.0. La prueba real deberá usar el comprador y los medios de prueba indicados por Mercado Pago; no una tarjeta real. Se comprobarán aprobación, rechazo, pendiente y activación exactamente una vez antes de habilitar producción.

## Decisiones y límites

- Un pago durante la prueba añade sus 30 días después de los días de prueba restantes.
- Una autorización firmada se emite por hasta siete días; el cliente 4.4.0 comprueba su firma, equipo, modo y expiración, además de la fecha de vencimiento comercial.
- Una devolución o contracargo deja la licencia en consulta, pendiente de revisión; no elimina la información del negocio.
- Una protección local no impide por completo que alguien modifique el programa o simule otra instalación. Las versiones anteriores sin límites siguen funcionando si no se actualizan.
- No hay conexión automática entre publicar estos archivos en GitHub y desplegar tu Worker.
- Revisa los límites y costos de Workers/D1 y las comisiones vigentes de Mercado Pago en tus cuentas. No se contrataron servicios ni se realizaron cobros desde este entorno.

## Desarrollo

Con Node 24 o superior, desde esta carpeta:

```sh
npm ci
npm run check
npm test
```

`wrangler.jsonc` es una alternativa para quien use la CLI: requiere sustituir el ID de D1 y la URL pública por los reales antes de desplegar. La guía del editor permite configurar todo sin instalar Node en tu computador.

## Corrección del editor de Cloudflare

Si el editor muestra errores sobre `privateKey` o los argumentos de `fetch`, reemplaza TODO `worker.js` por la versión actual de `worker-listo.js`. El paquete incorpora una comprobación de tipos (`npm run check`) además de las pruebas funcionales. Después pulsa **Deploy** y visita `/health`; la ruta raíz `/` no es una página de inicio de este servicio. Un `billingEnabled: false` significa que aún falta configuración de los pagos y no exige volver a cambiar el código.
