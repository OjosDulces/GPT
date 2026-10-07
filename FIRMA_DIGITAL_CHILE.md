# Firma de código para Control Emprende

Estado: pendiente de contratación, validación de identidad y emisión. El instalador 4.3.2 disponible sigue sin firma Authenticode.

## Solicitud preparada

- País del solicitante: Chile.
- Tipo de solicitante: persona natural / desarrollador individual.
- Producto: certificado público de firma de código Windows (Authenticode), con validación de identidad individual.
- Nombre del editor: nombre legal de la persona, pendiente de verificar por el proveedor. No asumir que se podrá mostrar «Control Emprende» como editor legal.
- Archivos a distribuir: aplicación Electron y su instalador Windows x64, con desinstalador.
- Custodia de clave preferida: servicio de firma en la nube, para evitar depender de un token físico.

## Proveedor candidato y puntos pendientes

SSL.com Code Signing y su servicio eSigner son candidatos para evaluar. No se verificaron en línea la admisión vigente de residentes de Chile, el precio ni las condiciones: las páginas oficiales devolvieron un bloqueo de red en este entorno. No se realizó una compra ni una solicitud de certificado.

Enlaces oficiales para comprobar las condiciones:

- https://www.ssl.com/certificates/code-signing/
- https://www.ssl.com/esigner/

Antes de contratar, confirmar con el proveedor:

1. Emisión para una persona natural residente en Chile y documentos admitidos.
2. Compatibilidad del certificado individual con el servicio de firma elegido.
3. Precio total: certificado, servicio de firma, cantidad de firmas, impuestos y renovación.
4. Firma Authenticode de archivos EXE y sellado de tiempo SHA-256.
5. Método de integración para firmar también el programa y el desinstalador durante la compilación.

La verificación de identidad se completa directamente en el portal oficial del proveedor. No enviar documentos de identidad, contraseñas, códigos de acceso ni claves privadas por este chat. Un certificado HTTPS del sitio o una firma electrónica de documentos no sustituye un certificado de firma de código.

## Trabajo después de la emisión

1. Integrar el servicio seleccionado sin incorporar secretos al código ni a los ZIP de entrega.
2. Firmar el programa y el desinstalador antes de generar el instalador final; firmar también el instalador y aplicar sellado de tiempo.
3. Verificar firmas, cadena de confianza, editor y sello de tiempo en Windows.
4. Regenerar los fragmentos de descarga, el manifiesto y los hashes del sitio a partir del instalador ya firmado. No reutilizar los hashes de la versión sin firma.
5. Probar instalación, actualización, desinstalación y descarga en Windows; después actualizar la distribución.

La firma identifica al editor y protege la integridad. No garantiza por sí sola la desaparición inmediata de avisos de SmartScreen. La instalación en Windows todavía está pendiente de prueba.
