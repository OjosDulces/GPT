# Guía rápida · Control Emprende 4.2

## En Windows

Instala el `.exe` entregado por separado y abre el acceso directo **Control Emprende**. La edición de escritorio es una demo local; consulta `docs/WINDOWS.md`.

## Prueba ahora

1. Descomprime todo el ZIP en una carpeta y abre `EMPIEZA_AQUI.html` con Chrome o Edge.
2. Elige **Abrir demo**. En la franja superior puedes cambiar entre Dulcería Aurora (CLP), Estudio Papel (PEN), Taller Creativo (USD) y Mi primer negocio (vacío).
3. En **Inicio**, revisa ventas, cobros, pendientes, meta y señales del asesor.
4. En **Nueva venta**, selecciona productos, cantidades, cliente y cuánto recibiste. El inventario automático descuenta al guardar; los servicios pueden no llevar stock.
5. En **Pedidos y pagos**, registra abonos y entregas. La fecha de vencimiento del pago es independiente de la entrega.
6. En **Mi asesor**, revisa alertas y prueba «¿Qué debería revisar hoy?». La demo usa reglas locales y lo indica; no simula respuestas de OpenAI.
7. En **Informes**, elige día, últimos siete días o mes en curso y descarga CSV.
8. En **Importar Excel / CSV**, descarga una plantilla, selecciónala, revisa los errores o duplicados y confirma. Nada se guarda antes de confirmar.

La demo conserva cambios solo en el navegador actual. **Reiniciar demo** recupera el ejemplo del negocio seleccionado. Los tickets de prueba tampoco se envían a nadie. La demo no admite pagos reales.

## Haz que se sienta tuya

Pulsa **Hazlo tuyo** en la cabecera (el icono de paleta en celular), o abre **Ajustes → Personalizar mi espacio**.

- **Estilo:** elige una de seis paletas o tu propio color. Prueba modo claro, oscuro o automático, espaciado compacto y texto grande.
- **Identidad:** sube tu logo, nombra tu espacio y escribe una frase que te represente.
- **Mi inicio:** elige Panorama o Enfoque, mueve y oculta tarjetas, y selecciona hasta cuatro accesos rápidos.

La vista previa ilustra los cambios. **Aplicar mi estilo** los guarda; **Cancelar** permite descartarlos. Se conservan por usuario y negocio en este navegador; no se sincronizan entre dispositivos. El nombre del espacio no cambia el nombre legal/comercial ni los comprobantes. Restablecer el estilo no borra ventas ni otros registros. Consulta `docs/PERSONALIZACION.md` para los detalles.

## Tu primer negocio conectado

Primero instala siguiendo `docs/INSTALACION.md`. Crea y confirma tu cuenta, entra a `/app` y crea tu negocio. El asistente inicial pide nombre, actividad, moneda, zona horaria, inventario y una meta opcional.

La moneda se elige antes de cargar precios u operaciones. Se admiten CLP, PEN, USD, MXN, COP y ARS, una por negocio. Cambiar una etiqueta no convierte importes; la aplicación bloquea el cambio cuando existen productos, gastos o ventas. La suscripción del servicio se cobra en CLP cualquiera sea la moneda operativa.

Carga productos o servicios, clientes, insumos y existencias iniciales. El inventario automático descuenta al vender; el manual depende de tus ajustes. Cambiar de modo no recalcula el pasado. Una anulación restituye existencias solo si la venta las descontó originalmente.

## Rutina diaria

- Registra ventas y pagos reales por separado. Una venta pendiente no aumenta lo cobrado.
- Marca entregas y agrega abonos desde el pedido; una corrección conserva el movimiento de ajuste.
- Registra gastos como pendientes o pagados. Las compras de insumos reponen materiales y registran el gasto en la misma operación.
- Si produces, comprueba la receta y los materiales disponibles antes de confirmar.
- Revisa alertas, pendientes e informes; descarga periódicamente un respaldo desde Ajustes.

El asesor necesita al menos cinco ventas y 14 días observados para mostrar el indicador. Para proyectar stock de un producto también requiere ventas en tres días distintos. No conocer suficientes datos no significa que el negocio vaya mal: mostrará «Aprendiendo».

La caja representa cobros con fecha menos egresos pagados. No representa el saldo de una cuenta bancaria. El resultado estimado depende de costos y gastos registrados; si faltan costos aparecerá un aviso. Los comprobantes son internos y no sustituyen documentación tributaria.

## Importar desde una planilla

Productos: `nombre`, `precio`; opcionales `costo`, `stock`, `stock_minimo`, `categoria`, `control_stock` (si/no). Clientes: `nombre`; opcionales `telefono`, `notas`.

XLSX lee la primera hoja y solo valores. CSV acepta comas o punto y coma y celdas entre comillas. Hasta 5 MB y 5.000 filas; los XLS antiguos deben guardarse como XLSX. No se admiten fórmulas. Usa números sin símbolos de moneda ni separadores de miles; con coma decimal, usa CSV separado por punto y coma. Los nombres duplicados se omiten, no se sobrescriben. Si una fila es inválida, corrige el archivo y vuelve a seleccionarlo.

## Equipo, planes y ayuda

El propietario administra preferencias y pagos. Plan Negocio permite cinco usuarios incluyendo al propietario; los lectores solo consultan. Las invitaciones vencen y el propietario puede renovarlas o retirar accesos. Una cuenta puede tener varios negocios separados.

En **Plan y pagos** se muestra el cupo de nuevas ventas del mes UTC. Borrar una venta no devuelve cupo. La renovación es manual por 30 días. Si un pago queda pendiente, pulsa **Comprobar** antes de iniciar otro. Al vencer el plan se conservan los datos; se aplican los límites de Gratis y los colaboradores quedan en lectura.

En **Metas y asesor** puedes autorizar el asesor en línea, informes automáticos, correo al propietario y diagnósticos. Los servicios deben estar instalados; autorizar una casilla no los despliega. Evita incluir información personal en las preguntas al asesor.

En **Ayuda** puedes buscar instrucciones y abrir un ticket. En una cuenta conectada la respuesta del operador aparece allí; no hay una promesa de respuesta automática ni un plazo contratado.

## Si algo falla

Lee el aviso antes de repetir una operación. Los formularios permanecen abiertos si falla un guardado. Si otra pestaña o persona guardó primero, actualiza los datos, revisa qué existe y vuelve a ingresar solo lo pendiente.

La aplicación conectada bloquea escrituras sin red y permite consultar la última copia disponible. No hay una cola que sincronice cambios offline. La demo local funciona sin red, pero no sincroniza dispositivos.

Para restaurar un respaldo JSON, descarga primero una copia actual y confirma el reemplazo del negocio correspondiente. Verifica nombre y moneda. Un respaldo descargado no reemplaza el respaldo del servidor. En teléfonos, abrir HTML local depende del sistema; para uso diario instala la web con HTTPS.
