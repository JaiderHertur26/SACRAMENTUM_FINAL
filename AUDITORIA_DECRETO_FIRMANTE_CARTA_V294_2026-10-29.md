# SACRAMENTUM V294 · Identificación de firmante y decreto en carta

Fecha 2026-10-29 (UTC).

## Corrección solicitada y evidencia de Decreto 0001.pdf
En la pieza presentada, «DA FE» contenía un código histórico `0006`, no el nombre de la autoridad que expidió el decreto. La firma y el sello aparecían en una **segunda página**. El encabezado decía `CAL-ODC-021`, versión `001`, con un texto superpuesto «COPIA DE REVISIÓN · CONTROL DOCUMENTAL».

## Implementación verificada
- Nuevo cuadro de selección antes de cada expedición: **Canciller** o **Vicecanciller**, con nombre real del directorio institucional, nunca un nombre suministrado libremente. Disponible en todos los seis formularios que utilizan el servicio de emisión central; futuras clases deben usar ese mismo servicio.
- Dos RPC controladas en Supabase: `list_chancery_decree_signers_v294` y `issue_chancery_form_decree_v294`. Sesión con rol Cancillería activo; nombre tomado de `chancelleries`, validado contra jurisdicción y guardado junto a `decretos.payload.issuingSigner` con rol, nombre, emisor y fecha. Auditoría `record_decree_signer_v294`.
- Se conserva la emisión V287/V280 sin asignación de Libro, Folio y Número nuevos hasta el asiento de la parroquia, y con la notificación institucional.
- En todos los impresores de corrección, reposición y en el generador archivístico compartido, `DA FE` usa el **nombre del firmante que expidió el decreto**, mientras el ministro original continúa en su línea independiente. Firma y cargo usan la misma autoridad.
- Encabezado para Barranquilla: `CÓDIGO: CAL-ODC-022 · VERSIÓN: 002` en corrección y reposición, incluidas plantillas alternativas.
- Se retiró del **decreto** la leyenda invasiva «COPIA DE REVISIÓN · CONTROL DOCUMENTAL» y marca diagonal. En el sistema con datos de ensayo se mantiene una señal discreta al pie que evita confundir documentos ficticios con oficiales; los restantes documentos de ensayo conservan sus protecciones.
- Hoja carta: márgenes 7 × 10 mm, filas y firma compactas, altura mínima del contenedor eliminada, escala adaptable si aumenta la longitud. **Chrome en modo impresión generó PDF con 1 objeto /Page**, incluidos firma y sello, sobre un expediente ficticio equivalente a la captura (corrección de Bautismo con 14 datos).

## Validaciones y alcance
- V294 aplicada en Supabase y en el catálogo de 195 migraciones con hash SHA-256.
- Prueba SQL end-to-end en transacción `BEGIN/ROLLBACK`, eligiendo Vicecanciller, validó `payload.issuingSigner`, datos del documento, aviso parroquial y ausencia de coordenadas anticipadas.
- Permisos RPC: ejecución de `anon` denegada; autenticados pasan por identidad y ámbito de Cancillería dentro de funciones.
- 6/6 pruebas específicas V294, 30/30 auditoría maestra; construcción Vite correcta.
- Permanecen **8.393 partidas de pruebas y un decreto antiguo**, sin modificaciones permanentes por QA.
- Los decretos anteriores sin selección grabada no tienen identidad elegida retroactivamente; el archivo usa como visualización de compatibilidad el Canciller institucional configurado, sin atribuir elecciones inexistentes.
