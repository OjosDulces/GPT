# Instalación y activación · 4.3

La demo se abre directamente. Esta guía instala la versión conectada. No hay cuentas, contraseñas ni claves privadas preconfiguradas. Prepara primero un entorno de pruebas.

## 1. Base de datos nueva

Crea un proyecto Supabase. En su SQL Editor ejecuta completos, uno por uno y en este orden:

1. `supabase/setup.sql`.
2. `supabase/migrations/003_commercial_foundation.sql`.
3. `supabase/migrations/004_integrated_product.sql`.
4. `supabase/migrations/005_reporting.sql`.
5. `supabase/migrations/006_public_catalogs.sql`.

No hay archivos 001 o 002 pendientes. El setup instala la base heredada, 003 introduce guardado atómico y roles, 004 añade el producto integrado y 005 el control de envío de informes y 006 las páginas públicas por negocio.

Comprueba que `business_data` pertenece a la publicación `supabase_realtime` (el setup la configura). Los datos se consultan con RLS y se guardan con `commit_business_data`. No abras permisos de escritura directa para resolver un error de instalación.

## 2. Autenticación

En Supabase Auth configura:

- Site URL: la raíz HTTPS del sitio, por ejemplo `https://tu-dominio.cl`.
- Redirect URLs: `https://tu-dominio.cl/app`; agrega `http://localhost:5173/app` únicamente en el proyecto de desarrollo si lo necesitas.
- Confirmación de correo y proveedor SMTP para altas/recuperación. Prueba ambos enlaces.
- Política de contraseña de al menos 10 caracteres, equivalente a la interfaz.

El propietario crea una cuenta normal y un negocio; no existe una clave de administrador incluida. La prueba de Inteligente dura 14 días desde la fecha de creación de cada negocio. Los negocios antiguos conservan esa fecha, no reciben una prueba nueva por actualizar.

## 3. Publicar la aplicación

### Usar la compilación incluida

Edita **solo los valores públicos** de `publicacion-directa/config.js`:

```js
window.APP_CONFIG = {
  DIRECT_DEPLOY: true,
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'TU_CLAVE_PUBLICA'
};
```

La clave debe ser la pública anon/publishable, nunca `service_role`. Publica el contenido de `publicacion-directa/` en un alojamiento estático HTTPS. Sirve `index.html` para rutas desconocidas (`/app`, `/operador`, `/catalogo/*`); los archivos `_redirects` y `_headers` incluyen la configuración para un proveedor compatible como Netlify. Otros servidores deben aplicar reglas equivalentes.

Los encabezados evitan incrustar la app en otros sitios y limitan conexiones a Supabase y formularios a Webpay. Si usas dominio propio para Supabase, actualiza `connect-src`. Conserva `config.js`, `index.html` y `sw.js` sin caché permanente. No cambies la ruta raíz sin adaptar la configuración PWA.

### Compilar desde el código

Instala Node.js 24+, copia `.env.example` a `.env` y completa las dos variables públicas de Supabase. Alternativamente configura `public/config.js`. No mezcles proyectos distintos entre esos archivos; `config.js` tiene prioridad.

```bash
npm ci
npm run check
```

Publica el nuevo contenido de `dist/`. `netlify.toml` configura `npm run build` y `dist` si despliegas desde un repositorio. `npm run dev` inicia el desarrollo y `npm run preview` permite revisar la compilación. La página comercial vive en `/`, la aplicación en `/app`, la demo en `/app?demo=1`, el operador en `/operador` y los catálogos en `/catalogo/<nombre>`.

Los HTML autónomos no son el frontend de producción: su propósito es la demostración local.

## 4. Funciones del servidor

Instala la CLI de Supabase, autentícate y enlaza el proyecto de pruebas:

```bash
supabase login
supabase link --project-ref TU_REFERENCIA
```

Copia `.env.functions.example` a `.env.functions`. Completa `SITE_URL` con el origen HTTPS de la web y deja los servicios desactivados hasta configurarlos. Las claves `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` están disponibles en el entorno de funciones administradas; no van en el frontend.

```bash
supabase secrets set --env-file .env.functions
supabase functions deploy billing-checkout
supabase functions deploy webpay-return
supabase functions deploy business-advisor
supabase functions deploy business-digest
```

`supabase/config.toml` usa `verify_jwt=false` porque los endpoints de usuario verifican explícitamente el token con `auth.getUser` y la membresía. El retorno de Webpay verifica la transacción con Transbank, y el proceso semanal exige `DIGEST_SECRET`. No elimines esos controles al desplegar.

El código de las funciones pasó comprobación de sintaxis y pruebas de lógica de pagos con dependencias simuladas. Debes comprobar ejecución e integraciones en Supabase real; no se dispuso aquí de Deno ni de tus cuentas.

## 5. Cobros Webpay

Primero configura `WEBPAY_ENV=integration`, código y clave del comercio de integración de Transbank. Activa `BILLING_ENABLED=true` cuando los datos estén completos. La interfaz muestra que se trata de integración. Usa exclusivamente los medios de prueba oficiales.

Webpay recibe el monto definido en el servidor. El plan se activa solo tras comprobar estado AUTHORIZED, código 0, monto, orden y sesión. Repetir la confirmación no extiende dos veces el período. El retorno es `/functions/v1/webpay-return` de Supabase, fijado por el servidor.

Comprueba aprobación, rechazo, cancelación, interrupción y reintento de consulta. **Comprobar** en Plan y pagos recupera una autorización cuyo retorno no llegó. Una orden de creación sin token puede cerrarse como cancelada al comprobar después de dos minutos, sin enviar una nueva confirmación de cobro.

Solo tras completar la habilitación de tu comercio y verificar el entorno real cambia `WEBPAY_ENV=production` y las credenciales. Los precios propuestos son CLP por negocio y por 30 días. No hay débito recurrente. Renovar el mismo plan agrega 30 días al período vigente; cambiar de plan inicia 30 días nuevos sin prorrateo. Esa condición se muestra antes de contratar.

El sistema no automatiza devoluciones, disputas ni conciliación masiva. Resuélvelas en Transbank y concilia después el período de acceso con un operador autorizado. No marques una orden como pagada para simular una confirmación real.

## 6. Asesor en línea

Configura `OPENAI_API_KEY` y `OPENAI_MODEL` con un modelo disponible en tu cuenta que admita Responses API. No se fija un modelo cuyo acceso no se haya comprobado. Configura límites de gasto en el proveedor.

El propietario debe activar **Permitir asesor IA en línea**. Solo Inteligente/Negocio (incluida la prueba vigente) tiene acceso; máximo 50 intentos diarios UTC por negocio. Un intento puede consumir cupo aunque el proveedor falle. La alternativa local continúa disponible.

El servidor calcula las métricas desde el negocio autorizado y envía pregunta y agregados. No agrega automáticamente nombres, teléfonos, correos, notas ni registros completos. Usa `store:false`; esto no sustituye las políticas de tratamiento del proveedor. Las preguntas escritas por una persona sí pueden contener datos que ella incluya. El asesor no tiene herramientas para ejecutar acciones.

## 7. Informes semanales y correo opcional

Crea un `DIGEST_SECRET` aleatorio largo, guárdalo únicamente en secretos del servidor y configura el propietario para permitir informes. El proceso toma la última semana completa de lunes a domingo según la zona horaria del negocio. Un índice único evita crear dos informes del mismo período. Solo procesa planes Inteligente/Negocio vigentes.

Para programar el proceso, habilita `pg_cron` y `pg_net` en Supabase y crea en Vault `ce_project_url` y `ce_digest_secret` (el mismo secreto del endpoint). Revisa y ejecuta `supabase/schedule.sql.example`. Agenda lunes a las 12:00 UTC. No dupliques la tarea al reinstalar; comprueba `cron.job`. La guía SQL incluye cómo desactivarla.

Los informes aparecen en la aplicación aun si no se envía correo. Para enviarlo, verifica un dominio/remitente en Resend, configura `RESEND_API_KEY`, `EMAIL_FROM` y `EMAIL_ENABLED=true`. El propietario debe activar también **Recibir el informe semanal por correo** y tener correo confirmado. El destino proviene de la cuenta del propietario; el cliente no puede indicar una dirección arbitraria.

Cada informe reserva un único intento antes de enviar y usa una clave de idempotencia. `email_status` queda `sent`, `review` o, ante una interrupción, `sending`. **No hay reintento automático de envíos ambiguos**: revisa la entrega en el proveedor usando la referencia `ce-weekly-ID_DEL_INFORME`. No vuelvas a poner `pending` sin confirmar que no se entregó; el proveedor retiene su idempotencia por tiempo limitado. La aplicación muestra envíos confirmados, pero no gestiona rebotes ni bajas por un enlace externo.

El proceso recorre negocios en lotes de 100 y realiza llamadas secuenciales. Para una base grande, añade una cola y checkpoints antes de escalar; no se validó carga masiva ni finalización bajo los límites de ejecución del proveedor.

## 8. Panel de operación y soporte

Después de crear la cuenta del operador, un administrador de la base ejecuta en SQL Editor, sustituyendo el correo por el correcto:

```sql
insert into public.platform_admins(user_id)
select id from auth.users where lower(email)=lower('operador@tu-dominio.cl')
on conflict do nothing;
```

Entra con esa cuenta y abre `/operador`. El servidor exige la asignación anterior: abrir la URL no concede permisos. El panel muestra contadores, planes, errores voluntarios y los últimos 100 tickets. Las respuestas aparecen en Ayuda del negocio. Configura quién atenderá el servicio antes de ofrecerlo a clientes; los tickets no generan correos de respuesta automáticos.

## 9. Actualizar desde 2.0

1. Respalda servidor y exportaciones; verifica restauración en un proyecto separado.
2. Si ya está instalada 003, aplica únicamente 004, 005 y 006, en ese orden. Si la instalación es anterior, aplica 003 primero. No ejecutes `setup.sql` sobre una instalación existente.
3. **No vuelvas a ejecutar 003 después de 004**: 004 envuelve el guardado original con los controles del producto. Para reparar una ejecución desordenada, reejecuta 004 y 005 en mantenimiento y valida permisos antes de reabrir el acceso.
4. Prueba monedas, registros históricos, stock, roles y planes. Los pagos heredados sin fecha permanecen como saldos históricos y no se inventan en un período de caja.
5. Coordina mantenimiento y reemplaza el frontend completo. Pide recargar pestañas y aceptar la actualización PWA. Conserva los respaldos anteriores.
6. Para volver atrás, restaura base y frontend compatibles desde los respaldos. No reviertas permisos a ciegas.

Si ya instalaste 4.2, aplica únicamente 006 y actualiza el frontend. Consulta `CATALOGOS_WEB.md`.

003 se probó repetible antes de 004; 004 y 005 se probaron repetibles sobre la instalación final. No uses `supabase db push` de forma indiscriminada: el setup no es una migración numerada y esta guía controla el orden explícitamente.

## 10. Verificación y operación

Completa los casos de aceptación real en `VALIDACION.md`. Configura respaldos del proyecto, recuperación ensayada, monitorización de errores, política de privacidad, condiciones comerciales y procedimiento de atención antes del lanzamiento. Los textos comerciales y precios incluidos son editables; no se generó una política legal ni una factura fiscal.

El almacenamiento usa colecciones JSON por negocio y un bloqueo/versionado por operación; el límite del payload es 20 MB. Es una base de MVP para pequeños negocios, sin prueba de carga empresarial. La versión conectada es de solo lectura sin red; no sincroniza ediciones offline.

Referencias técnicas oficiales consultadas: [Supabase Auth](https://supabase.com/docs/guides/functions/auth), [Supabase y tareas programadas](https://supabase.com/docs/guides/functions/schedule-functions), [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses), [Webpay REST](https://github.com/TransbankDevelopers/transbank-developers-docs/blob/master/referencia/webpay/README.md), [idempotencia en Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).
