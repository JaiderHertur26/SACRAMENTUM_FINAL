# SACRAMENTUM · DOCUMENTO MAESTRO DE CONTINUIDAD
## Estado de corte: 18 de septiembre de 2026 · 13:30 Colombia
## Ruta canónica: C:\SACRAMENTUM\SACRAMENTUM_FINAL

> ESTE ARCHIVO ES LA FUENTE OFICIAL DE CONTINUIDAD DEL PROYECTO.
> El próximo chat debe leerlo COMPLETO antes de modificar código y después trabajar inmediatamente.
> No pedir al usuario que repita contexto ya documentado aquí.
> No reconstruir el proyecto desde cero ni deshacer migraciones aprobadas.

---

# 0. ORDEN AL PRÓXIMO CHAT

Actúa como responsable técnico integral de SACRAMENTUM. Tienes permiso del usuario para inspeccionar, corregir, agregar, quitar y reorganizar código siempre que protejas los datos sacramentales reales.

Al comenzar:
1. Conecta Remote Desktop Commander al equipo JAIDERHERRERA-TURIZO.
2. Trabaja EXCLUSIVAMENTE en C:\SACRAMENTUM\SACRAMENTUM_FINAL.
3. Lee este archivo completo.
4. Verifica el estado actual con git/diff o lectura directa antes de editar.
5. Continúa desde la sección **PUNTO EXACTO DE REANUDACIÓN**.
6. No preguntes “¿qué hacemos ahora?”: el trabajo pendiente está documentado.
7. Da actualizaciones breves al usuario mientras ejecutas.
8. No declares una fase terminada sin build + postflight + prueba funcional correspondiente.

---

# 1. IDENTIDAD DEL PROYECTO

SACRAMENTUM es un sistema eclesial de registro sacramental para Diócesis/Arquidiócesis y Parroquias.

Stack principal:
- Vite
- React
- Tailwind CSS
- Supabase/PostgreSQL
- RLS y RPC para operaciones críticas
- Despliegue objetivo: Vercel / entorno web
- Desarrollo Windows 10/11

Ruta única válida:
`C:\SACRAMENTUM\SACRAMENTUM_FINAL`

NO volver a trabajar en:
- `C:\SACRAMENTUM\fase3-chat`
- copias viejas de SacramentumRegistry
- servidores Vite antiguos

Servidor de desarrollo habitual:
`http://localhost:5173`

Hubo anteriormente varias instancias Vite compitiendo por 5173. Se limpió para dejar SACRAMENTUM_FINAL. Si algo “parece viejo”, verificar primero qué proceso/carpeta sirve el puerto.

---

# 2. SUPABASE CORRECTO

Proyecto:
- Nombre: REGISTRO SACRAMENTOS
- Project ref: `foczofcmwampjvlfbsqn`
- Región: East US (Ohio)
- Organización: `ifkqjpdqvmmdguushglg`

El CLI quedó autenticado correctamente en esta conversación.

Comandos confirmados:
```cmd
cd /d C:\SACRAMENTUM\SACRAMENTUM_FINAL
npx supabase projects list
type supabase\.temp\project-ref
```

Debe aparecer:
`foczofcmwampjvlfbsqn`

IMPORTANTE:
- No usar `--profile sacramentum`: ese perfil estuvo roto.
- Usar el perfil por defecto.
- Esta versión del CLI NO usa `--query`.
- Para ejecutar SQL usar preferentemente:
```cmd
npx supabase db query --linked --file ruta\archivo.sql
```
- También acepta SQL como argumento directo, pero en Windows `--file` es más estable.

No ejecutar SQL si `projects list` muestra únicamente proyectos CAMINO.

---

# 3. ROLES Y JERARQUÍA DEFINITIVOS

Administrador General:
- único nivel global;
- crea usuarios Diócesis/Arquidiócesis;
- no crea parroquias ni Cancillería directamente.

Diócesis/Arquidiócesis:
- crea usuarios Parroquia;
- crea exactamente un Canciller activo;
- gobierna estructura territorial.

Parroquia:
- registra sacramentos;
- digitaliza partidas históricas;
- maneja boletas;
- consulta/imprime;
- consume Datos Auxiliares propios.

Canciller:
- único por diócesis;
- autoridad exclusiva para correcciones y decretos de reposición.

Jerarquía territorial:
Diócesis/Arquidiócesis → Vicaría → Decanato → Parroquia.

Principio multi-tenant:
TODO lo importado o creado debe tener una parroquia propietaria cuando se trate de datos parroquiales.
La parroquia escrita dentro de un JSON legacy es PROCEDENCIA HISTÓRICA, no cambia el propietario operativo.

Ejemplo:
- propietario seleccionado: MARÍA AUXILIO DE LOS CRISTIANOS
- JSON dice: PADRE MISERICORDIOSO
Resultado:
- owner_parish_id = María Auxilio
- source_parish_name = Padre Misericordioso

---

# 4. PRINCIPIOS DE SEGURIDAD DOCUMENTAL

1. Nunca inventar hechos sacramentales históricos.
2. Nunca inventar sacerdote, Da Fe, ministro, fecha, parroquia, libro/folio/número.
3. Datos explícitos del libro/JSON histórico tienen prioridad sobre inferencias.
4. La inferencia por fecha sólo es una PROPUESTA cuando el dato documental no está explícito.
5. Digitalización histórica no consume consecutivos ordinarios vivos.
6. Boletas históricas y manuales son documentos permanentes: no desaparecen al sentar.
7. No reutilizar números ya consumidos.
8. No desactivar una partida sacramental por fallecimiento: “Fallecido” es condición adicional.
9. Correcciones/reposiciones sólo Canciller.
10. No debilitar RLS para “hacer funcionar” una pantalla.
11. Todo cambio estructural crítico debe tener postflight.
12. Los smokes de prueba deben usar BEGIN/ROLLBACK para no dejar datos ficticios.

---

# 5. ESTADO GLOBAL OBSERVADO EN EL PANEL

Última captura del Panel Parroquial:
- Bautismos: 48
- Confirmaciones: 174
- Matrimonios: 1
- Exequias: 1
- Total registros: 224

Parroquia operativa principal:
- ID: `ada2c810-c6eb-4b75-8e3c-4941e3022687`
- Nombre: PARROQUIA MARÍA AUXILIO DE LOS CRISTIANOS
- Diócesis: `452d50bc-ff3e-448e-9b93-1e97f8d321e2`

Usuario parroquial visto en capturas:
- MIGUEL TURIZO
- rol Parroquia

---

# 6. BAUTISMO · ESTADO REAL

Partidas permanentes:
- 48 actualmente.
- La partida manual original #000001 fue restaurada legítimamente desde auditoría.

Boletas:
- Reportadas/Historial: 18
- Pendientes: 0 en el último postflight.

Boleta manual restaurada:
- pending_id: `f17a57ee-4904-4a57-94d3-0e089b3de2fa`
- Nº Registro: `000001`
- Nombre auditado: JUAN BAUTISMO PRUEBA SACRAMENTUM
- status: seated
- reportado: true
- boleta_archived: true
- seated_baptism_id: `c4570f19-b42c-425c-aaf8-5ca51f4ab58e`
- Libro/Folio/Número: 0001 / 0001 / 0001

Partida restaurada:
- baptism_id: `c4570f19-b42c-425c-aaf8-5ca51f4ab58e`
- se restauró porque L/F/N y Nº Registro estaban libres;
- no se retrocedieron consecutivos.

Migraciones importantes:
- V8: `SACRAMENTUM_BAUTISMO_BOLETA_PERMANENTE_V8.sql`
  - al sentar, la boleta queda reportada/seated;
  - conserva `seated_baptism_id`, libro, folio, número;
  - boleta_archived=true.
- V9: `SACRAMENTUM_RESTORE_MANUAL_BOLETA_000001_V9.sql`
  - restauró boleta y partida #000001 desde auditoría.

Smoke V8:
crear boleta → sentar → comprobar boleta → comprobar partida → ROLLBACK.
Pasó y dejó 0 datos de prueba.

Regla definitiva:
- Boleta pending → Individual/Por lote.
- Al sentar → NO se elimina.
- Pasa a Reportadas/Historial y queda reimprimible.

---

# 7. CONFIRMACIÓN · ESTADO REAL

Partidas permanentes:
- 174.
- Auditoría de fechas confirmó 174/174 con `celebration_date` no nulo.

Boletas:
- Reportadas/Historial: 117.
- Pendientes: 0 en el último postflight.

Boleta manual #000001 restaurada:
- pending_id: `571f5358-1a32-4a06-b438-64298c5156a2`
- Nº Registro: 000001
- status: seated
- reportado: true
- boleta_archived: true
- fecha auditada: 2026-09-07
- Libro/Folio/Número histórico de la boleta: 0001 / 0001 / 0001
IMPORTANTE:
La antigua partida manual de Confirmación:
- ID: `67ca9e4f-5cfe-406b-be70-61c574f9f8ef`
fue retirada anteriormente.
NO se restauró porque L/F/N 0001/0001/0001 hoy pertenece legítimamente a una Confirmación histórica real:
- ID: `3ea151d4-26a8-42e0-afd9-b7b866da1067`
- ANDRES EDUARDO VELASQUEZ INSIGNARES.

Por eso la boleta #000001 se conserva para reimpresión con:
- `seated_record_available=false`
- `historical_seat_confirmed=true`
sin crear una partida duplicada.

Migraciones:
- V10: `SACRAMENTUM_CONFIRMACION_BOLETA_PERMANENTE_V10.sql`
  - futuras boletas sobreviven al asiento;
  - guarda `seated_confirmation_id`, L/F/N y boleta_archived.
- V11: `SACRAMENTUM_RESTORE_CONFIRMACION_BOLETA_000001_V11.sql`
  - restauró la boleta manual histórica desde auditoría, sin duplicar la partida.

Smoke V10:
crear Confirmación manual → sentar → comprobar boleta vinculada → ROLLBACK.
Pasó con 0 datos de prueba.

---

# 8. FECHAS DE CONFIRMACIONES IMPORTADAS
Problema observado:
Panel Parroquial mostraba “SIN FECHA” para Confirmaciones importadas.

Diagnóstico:
- la base estaba correcta;
- 174/174 tenían `celebration_date`;
- el Panel consultaba Confirmación sin traer `celebration_date`.

Correcciones ya realizadas:
- `ParishDashboard.jsx` ahora selecciona `celebration_date`;
- normaliza `sacramentDate`;
- contempla fallback `feccon`;
- `sacramentsService.js` contempla `payload.feccon`;
- `ConfirmationSentarRegistrosPage.jsx` contempla `r.feccon`.

Build después de esta corrección:
- 3114 módulos
- exit code 0.

---

# 9. DA FE Y MINISTRO EN CONFIRMACIÓN LEGACY

Archivo CONFIRMA:
- 173 filas.
- 173/173 tienen `ministro`.
- 173/173 tienen `dafe`.

Distribución Da Fe:
- 0002: 12
- 0003: 157
- 0004: 4
PARROCOS:
- 0001 → PBRO. ROBERTO PADILLA MARTÍNEZ
- 0002 → PBRO. SANTIAGO MARTÍNEZ FUENTES
- 0003 → PBRO. TEODORO GARCÍA GARCÍA
- 0004 → PBRO. JAIDER HERRERA TURIZO

Regla confirmada por el usuario:
El código `dafe` del archivo histórico es una CLAVE DOCUMENTAL.
Debe resolverse contra PARROCOS.
NO cuestionar esa relación por las fechas de servicio.

Migración aplicada:
`SACRAMENTUM_CONFIRMACION_RESOLVER_DAFE_LEGACY.sql`

Resultado:
- 173/173 Da Fe resueltos.
- Se preserva código original.
- Se preserva nombre resuelto.
- Se preserva fuente y SHA.
- Ministro histórico se conserva exactamente como viene en CONFIRMA.

NO volver a introducir la vieja “máquina del tiempo” que infería Da Fe histórico ignorando el código explícito.

---

# 10. EXEQUIAS ↔ BAUTISMO

Función implementada y aplicada en Supabase:
`SACRAMENTUM_EXEQUIAS_BAUTISMO_FALLECIDO_V7.sql`
Flujo:
1. En Exequias se puede buscar persona en Bautismos celebrados de la misma parroquia.
2. Seleccionar partida completa:
   - nombres;
   - apellidos;
   - sexo;
   - nacimiento;
   - lugar;
   - padres;
   - documento disponible;
   - referencia de Bautismo.
3. Se guarda `baptism_id`.
4. Guardar borrador NO marca fallecido.
5. Sólo al ASENTAR Exequia:
   - Bautismo `is_deceased=true`;
   - death_date;
   - death_place;
   - linked_funeral_id;
   - nota marginal de defunción.
6. Bautismo sigue “Vigente”; “Fallecido” es indicador separado.
7. Todo ocurre transaccionalmente.

Postflight V7:
- columnas: true
- triggers: true
- funciones: true
- nuip: existe

Smoke:
Exequia ficticia vinculada dentro de transacción → Bautismo fallecido + nota marginal → ROLLBACK.
0 datos ficticios finales.

---

# 11. CENTRO DE MIGRACIÓN · REGLAS DEFINITIVAS
Centro de Migración es el ÚNICO lugar para cargas masivas/importaciones.

Toda importación requiere parroquia propietaria.

Flujo:
archivo → análisis → staging → revisión → importación idempotente → auditoría → materialización operativa cuando corresponde.

No importar directamente desde Datos Auxiliares ni Ajustes.

Perfiles importantes:
- BAUTIZOS
- CONFIRMA
- INSBAUTI
- INSCONFI
- PARROCOS
- CIUDADES
- DIOCESIS
- IGLESIAS
- OBISPOS
- otros legacy.

INSBAUTI / INSCONFI:
TODAS las filas se preservan.

`reported=true`:
- boleta histórica reportada;
- debería existir partida;
- buscar coincidencia única;
- si coincide, vincular;
- si no: “Reportada · partida no localizada”;
- no inventar partida.
`reported=false`:
- boleta histórica NO SENTADA;
- debe quedar operativamente pendiente para ser sentada;
- no consume L/F/N al importar.

V6 aplicada:
`SACRAMENTUM_LEGACY_BOLETAS_OPERACIONALES_V6.sql`

Después de V6:
- INSBAUTI materializado a `pending_baptisms`;
- INSCONFI materializado a `pending_confirmations`.

Conteos vistos tras V6:
- Bautismo legacy reportadas: 17 antes de restaurar #000001.
- Confirmación legacy reportadas: 116 antes de restaurar #000001.
Luego quedaron:
- Bautismo historial: 18.
- Confirmación historial: 117.

---

# 12. ARCHIVOS LEGACY Y HASHES

Fuentes conocidas:

BAUTIZOS:
- filas: 46
- procedencia: PARROQUIA MARÍA AUXILIO DE LOS CRISTIANOS
- SHA256: `0a6a9db4a0a78ec7f6361051ddf806fb3946cfbe6ea38b91737ea39dd6d8f416`

CONFIRMA:
- filas: 173
- procedencia: PARROQUIA SANTA TERESITA DEL NIÑO JESUS
- SHA256: `6d9a2f5e48137d989805da91398d6cf251058a8f1763383f6b4452b9847fca1e`
INSBAUTI:
- filas: 17
- procedencia: PARROQUIA PADRE MISERICORDIOSO
- todos los vistos en esta copia: reported=true
- SHA256: `a9143e4b3249bc2f3ae2e504405c3d7251f623eb9c9de3f8033b63d0299a8e1e`

INSCONFI:
- filas: 116
- procedencia: PARROQUIA SANTA TERESITA DEL NIÑO JESUS
- SHA256: `51bb914fa682241f0179ad609df3aa4fe3abf7fb98a2f2dd4b47602fd027ed07`

PARROCOS:
- filas: 4
- SHA256: `4b8503d737777c378cf48dc25ed1d803dbb5848b555246b29e67f40cb3ca04f3`

CIUDADES:
- inventario detectado: 1.502 referencias aproximadamente.

DIOCESIS:
- inventario detectado: 103 filas.
- existe colisión real del código 01895 entre jurisdicciones distintas.
- nunca asumir código diocesano globalmente único sin nombre/contexto.

IGLESIAS:
- inventario detectado: 1.139 filas aproximadamente.
- María Auxilio aparece con código 100091, Barranquilla, diócesis 04652.
- existen homónimos fuera de Colombia; no enlazar sólo por nombre.

OBISPOS:
- el archivo compartido en una ronda tenía 0 filas.
- no inventar contenido.
---

# 13. PROPIEDAD DE IMPORTACIONES

Regla del usuario:
Aunque el JSON diga otra parroquia, la parroquia seleccionada en Centro de Migración es la propietaria operativa.

La procedencia legacy se conserva separada.

Nunca crear automáticamente una parroquia operativa porque un archivo legacy la mencione.

No crear Santa Teresita o Padre Misericordioso sólo para “hacer coincidir” el JSON.

---

# 14. IMPORTACIONES ANTIGUAS ELIMINADAS DE OTRAS SECCIONES

TAREA ACTUAL DEL USUARIO:
“Todas las Importaciones que están en Datos Auxiliares y Ajustes/Importar Catálogos y Registros deben quitarse de ahí y llevarlos al Centro de Migración.”

Trabajo YA HECHO en el corte actual:
- `ParroquiaAjustesPage.jsx` fue reemplazada.
- Ajustes ya NO tiene importador.
- muestra explicación y enlace al Centro de Migración.

Se retiraron botones visibles “Importar JSON” de:
- `ParrocosList.jsx`
- `ObisposList.jsx`
- `CiudadesList.jsx`
- `DiocesisList.jsx`
- `IglesiasList.jsx`
- `MisDatosList.jsx`
IMPORTANTE:
El código de modales/importadores internos puede seguir existiendo sin botón.
Después del build, limpiar imports/estado muerto si genera errores o warnings.
No volver a mostrar esos botones.

---

# 15. DATOS AUXILIARES INTELIGENTES · V12

Archivo aplicado:
`supabase/applied-history/SACRAMENTUM_AUXILIARY_INTELLIGENCE_V12.sql`

Se aplicó a Supabase con exit code 0.

V12 introduce:
- `bishop_tenures`: historial separado de Obispos titulares.
- columnas auxiliares en `obispos`.
- índices de catálogos.
- RLS para bishop_tenures.
- RPC `sacramentum_priest_at_date(uuid,date)`.
- RPC `sacramentum_bishop_at_date(uuid,date)`.
- RPC `sacramentum_recalculate_current_priest(uuid)`.
- RPC `materialize_auxiliary_catalog_batch(uuid)`.

Objetivo:
Centro de Migración deja de ser sólo archivo legacy y alimenta catálogos operativos de la parroquia propietaria.

Antes de V12 se comprobó:
- public.parrocos = 0
- public.obispos = 0
- public.iglesias = 0
- public.ciudades = 0
para la realidad operativa observada.
Eso explica por qué formularios no podían autocompletar aunque los JSON ya se hubieran importado en capas legacy.
`legacyMigrationService.js` YA fue modificado:
Después de `apply_legacy_import_batch_v2`, llama:
`materialize_auxiliary_catalog_batch`.

Esto debe verificarse con build y un lote real/postflight.

---

# 16. PÁRROCOS · REGLA DEFINITIVA

El usuario quiere que el sistema identifique al párroco actual automáticamente tanto si:
- fue importado;
- fue creado manualmente.

Criterio:
- fecha de ingreso vigente más reciente;
- fecha de salida si existe;
- nunca inventar fecha de salida.

Trabajo YA HECHO:
- `catalogsService.js` recibió `getParrocoEnFecha(parishId,date)`.
- `getParrocoActual` usa ese motor.
- se reemplazó el motor anterior que podía fabricar fechas de salida.
- `actualizarParrocoActual` ahora debe delegar en RPC `sacramentum_recalculate_current_priest`.
- se creó hook común `src/hooks/useSacramentalAuxiliaries.js`.

Regla actual/nuevo registro:
- Sacerdote celebrante: precargar párroco actual, pero editable/borrable porque pudo celebrar otro.
- Da Fe: párroco actual. Para registro actual debe corresponder al párroco actual.
- no usar simplemente `estado=1` si las fechas dicen otra cosa.
Regla histórica:
- sugerir párroco vigente en fecha de celebración;
- Celebrante editable;
- Da Fe sugerido según fecha, editable si el libro dice explícitamente otro.
- dato documental explícito gana sobre inferencia.

---

# 17. OBISPOS · DOS CONCEPTOS SEPARADOS

El usuario fue explícito:

A) DIRECTORIO DE OBISPOS / MINISTROS
- tabla `obispos`;
- lista de opciones posibles;
- obispos titulares, auxiliares, eméritos, visitantes, delegados/ministros según diseño;
- sirve para autocomplete del campo Ministro.

B) HISTORIAL DE OBISPOS TITULARES
- tabla nueva `bishop_tenures`;
- responde “quién era el Obispo titular en esta fecha”.
- campos base: bishop, start_date, end_date, notas/fuente.

En Confirmación histórica:
- al escoger fecha, sugerir automáticamente Obispo titular vigente;
- usuario puede cambiar a otro Obispo/Delegado del directorio;
- si el documento histórico trae Ministro explícito, no sobrescribirlo arbitrariamente.

PENDIENTE:
Crear UI en Datos Auxiliares para “Obispos Titulares” separada de la pestaña “Obispos”.
---

# 18. MOTOR COMÚN DE AUTOCOMPLETADO

Archivo YA CREADO:
`src/hooks/useSacramentalAuxiliaries.js`

Carga por parroquia:
- parrocos
- iglesias
- ciudades
- obispos
- bishop_tenures

Expone:
- `currentPriest`
- `priestAtDate(date)`
- `bishopAtDate(date)`
- `cityOptions`
- `churchOptions`
- `priestOptions`
- `bishopOptions`
- refresh/loading

PENDIENTE CRÍTICO:
Aún NO está conectado a los ocho formularios sacramentales.
No declarar esta tarea terminada.

---

# 19. COMPORTAMIENTO DE FORMULARIOS QUE DEBE QUEDAR

## NUEVO BAUTISMO
- Lugar Nacimiento: autocomplete CIUDADES.
- Parroquia/Lugar: por defecto parroquia propietaria.
- también autocomplete IGLESIAS.
- Sacerdote Celebrante: párroco actual por defecto, editable.
- Párroco que Da Fe: párroco actual.
## BAUTISMO YA CELEBRADO
- Lugar Bautismo: parroquia propietaria por defecto + autocomplete IGLESIAS.
- Lugar Nacimiento: CIUDADES.
- Fecha celebración dispara:
  - Celebrante sugerido = párroco vigente en esa fecha;
  - Da Fe sugerido = párroco vigente en esa fecha.
- ambos pueden conservar/aceptar dato documental manual.
- no tocar L/F/N vivos.

## NUEVA CONFIRMACIÓN
- Lugar celebración: parroquia propietaria + IGLESIAS.
- lugar nacimiento cuando el formulario lo tenga: CIUDADES.
- Da Fe: párroco actual.
- Ministro: NO asumir párroco; usar directorio de Obispos/Ministros según naturaleza del campo.
- si el flujo actual requiere Obispo/Delegado, proponer opción institucional apropiada sin inventar.

## CONFIRMACIÓN YA CELEBRADA
- Lugar: IGLESIAS.
- nacimiento: CIUDADES.
- Da Fe: párroco vigente por fecha.
- Ministro (Obispo/Delegado):
  - sugerir Obispo titular vigente por fecha;
  - editable;
  - autocomplete directorio de Obispos/Ministros.
- explícito del libro/JSON siempre gana.
## NUEVO MATRIMONIO
- lugar ceremonia: parroquia propietaria + IGLESIAS.
- lugares nacimiento esposo/esposa: CIUDADES.
- Sacerdote/Diácono asistente: párroco actual como propuesta, editable.
- Da Fe: párroco actual.

## MATRIMONIO YA CELEBRADO
- lugar celebración: IGLESIAS.
- nacimientos esposo/esposa: CIUDADES.
- fecha matrimonio determina párroco histórico sugerido para Presencia y Da Fe.
- editable cuando el documento diga otra cosa.

## NUEVA EXEQUIA
- lugar nacimiento: CIUDADES.
- lugar/templo: parroquia propietaria + IGLESIAS.
- Ministro: párroco actual por defecto, editable.
- Da Fe: párroco actual.
- además conserva búsqueda/vínculo con Bautismo.

## EXEQUIA HISTÓRICA/YA CELEBRADA
- lugar nacimiento: CIUDADES.
- lugar/templo: IGLESIAS.
- fecha exequias determina párroco histórico sugerido.
- ministro/Da Fe pueden transcribir dato explícito.

---

# 20. COMPONENTES AUTOCOMPLETE YA EXISTENTES
Existen:
- `CityAutocomplete`
- `ChurchLocationAutocomplete`
- datalist/listas de párrocos en algunos formularios.

No crear ocho componentes distintos si se puede reutilizar.
Objetivo: escribir “BAR…” y ver ciudades inmediatamente.
Para iglesias: escribir fragmento y ver parroquias/templos.
Debe permitir valor manual cuando corresponda, no sólo selección cerrada.

---

# 21. ARCHIVOS CLAVE DE LA TAREA ACTUAL

Backend/migración:
- `supabase/applied-history/SACRAMENTUM_AUXILIARY_INTELLIGENCE_V12.sql`
- `src/services/legacyMigrationService.js`
- `src/services/catalogsService.js`
- `src/hooks/useSacramentalAuxiliaries.js`

Centro/Datos auxiliares:
- `src/pages/parish/ParroquiaAjustesPage.jsx`
- `src/pages/parish/DatosAuxiliaresPage.jsx`
- `src/pages/parish/auxiliary/ParrocosList.jsx`
- `src/pages/parish/auxiliary/ObisposList.jsx`
- `src/pages/parish/auxiliary/IglesiasList.jsx`
- `src/pages/parish/auxiliary/CiudadesList.jsx`
- `src/pages/parish/auxiliary/DiocesisList.jsx`
- `src/pages/parish/auxiliary/MisDatosList.jsx`

Formularios:
- `BaptismNewPage.jsx`
- `BaptismCelebratedPage.jsx`
- `ConfirmationNewPage.jsx`
- `ConfirmationCelebratedPage.jsx`
- `MatrimonioNewPage.jsx`
- `MatrimonioCelebratedPage.jsx`
- `FuneralRegistryPage.jsx`
---

# 22. PUNTO EXACTO DE REANUDACIÓN · NO SALTAR

ESTO ES LO ÚLTIMO QUE SE ESTABA HACIENDO CUANDO SE LLENÓ EL CHAT.

YA HECHO:
1. V12 escrita.
2. V12 aplicada en Supabase con exit code 0.
3. `legacyMigrationService.js` llama materialización de catálogos.
4. `ParroquiaAjustesPage.jsx` ya no importa; remite a Centro de Migración.
5. Se removieron seis botones “Importar JSON”.
6. Se creó `useSacramentalAuxiliaries.js`.
7. `catalogsService.js` recibió motor por fecha.
8. Motor viejo que fabricaba fechas de salida fue sustituido por recálculo canónico RPC.

TODAVÍA NO HECHO:
1. NO se ejecutó build después de estos últimos cambios V12/UI/hook.
2. NO se ejecutó postflight completo de V12.
3. NO se verificó que catálogos ya importados anteriormente hayan sido backfilled/materializados.
4. NO se creó UI “Obispos Titulares”.
5. NO se conectó `useSacramentalAuxiliaries` a los 8 flujos.
6. NO se probaron autocompletados end-to-end.
7. NO se probó alta manual de párroco → recálculo actual.
8. NO se probó importación PARROCOS → materialización → actual.
9. NO se probó Obispo titular por fecha.
10. NO se limpió código muerto de antiguos import modals si el build lo marca.

EL PRÓXIMO CHAT DEBE CONTINUAR AQUÍ.
---

# 23. ORDEN DE EJECUCIÓN RECOMENDADO AL REANUDAR

### Fase A · Sanidad inmediata
1. Leer V12 completa.
2. Ejecutar:
```cmd
cd /d C:\SACRAMENTUM\SACRAMENTUM_FINAL
npm run build
```
3. Corregir cualquier error de imports/JSX/variables.
4. No avanzar hasta build exit 0.

### Fase B · Postflight V12
Comprobar:
- `bishop_tenures` existe y RLS.
- RPC priest_at_date.
- RPC bishop_at_date.
- RPC recalculate_current_priest.
- RPC materialize_auxiliary_catalog_batch.
- índices.
- tablas catálogos.
- ninguna política excesivamente permisiva.

### Fase C · Backfill de catálogos existentes
Buscar lotes `legacy_import_batches` de:
- PARROCOS
- IGLESIAS
- CIUDADES
- OBISPOS
por parroquia propietaria.
Si existen y están completed/imported:
- llamar `materialize_auxiliary_catalog_batch(batch_id)`.
- verificar conteos en `parrocos/iglesias/ciudades/obispos`.
- no reimportar manualmente si se puede materializar idempotentemente.

Si no existen lotes:
- investigar dónde quedaron los directorios legacy antes de inventar un backfill.
- no copiar por nombre sin evidencia de propiedad.

### Fase D · UI Obispos Titulares
Crear componente separado, por ejemplo:
`auxiliary/ObisposTitularesList.jsx`
CRUD:
- obispo/directorio;
- nombre;
- fecha inicio;
- fecha fin;
- notas.
Añadir pestaña en DatosAuxiliaresPage:
- “Obispos” = directorio.
- “Obispos Titulares” = tenures.

### Fase E · Formularios
Conectar hook común en este orden:
1. BaptismNewPage
2. BaptismCelebratedPage
3. ConfirmationNewPage
4. ConfirmationCelebratedPage
5. MatrimonioNewPage
6. MatrimonioCelebratedPage
7. FuneralRegistryPage (nuevo)
8. FuneralRegistryPage (histórico/edición si está en la misma pantalla)

### Fase F · Gates
- build
- postflight
- smokes con ROLLBACK
- prueba UI manual.
---

# 24. PRUEBAS FUNCIONALES OBLIGATORIAS

## Párrocos
Caso:
- P1 ingreso 2012-01-30 salida 2021-01-10
- P2 ingreso 2021-01-11 salida 2025-06-15
- P3 ingreso más reciente vigente
Debe:
- actual = P3;
- fecha 2014 = P1;
- fecha 2023 = P2.
No fabricar salidas.

## Bautismo nuevo
Abrir formulario:
- lugar = parroquia cuenta;
- celebrante = párroco actual;
- Da Fe = párroco actual;
- escribir ciudad → sugerencias;
- escribir iglesia → sugerencias;
- celebrante puede cambiarse.

## Bautismo histórico
Cambiar fecha:
- autoridad sugerida debe cambiar según período.
Si usuario ya escribió autoridad documental:
- no sobrescribir silenciosamente al cambiar otros campos.

## Confirmación histórica
Cambiar fecha:
- Obispo titular sugerido correcto.
- permitir elegir otro Obispo/Delegado.
- Da Fe por párroco histórico.
- si dato histórico explícito existe, respetarlo.
## Matrimonio
- ambos lugares nacimiento autocomplete.
- lugar celebración iglesias.
- actual/histórico según tipo.

## Exequias
- búsqueda Bautismo sigue funcionando.
- autollenado no se rompe.
- ciudad/iglesia/autoridades nuevas conviven con vínculo bautismal.
- asiento sigue marcando fallecido sólo al sentar.

---

# 25. PRIORIDAD ENTRE FUENTES DE DATOS

Para un campo histórico:
1. dato explícito de la partida/libro/JSON;
2. dato de catálogo legacy relacionado por código;
3. sugerencia temporal por fecha;
4. default parroquia actual sólo si el campo está vacío y el contexto lo permite.

Nunca invertir ese orden.

Para registro actual:
1. dato elegido por usuario;
2. default institucional actual;
3. catálogo.

---

# 26. MIGRACIONES/GATES HISTÓRICOS IMPORTANTES

Bautismo:
- cierre/postflight y E2E históricos existentes.
- V8 boleta permanente.
- V9 restauración #000001.

Confirmación:
- integridad base.
- histórica inmutable.
- consecutivos inmutables.
- asiento canónico.
- autoridad Cancillería estricta.
- resolución Da Fe legacy.
- V10 boleta permanente.
- V11 restauración boleta #000001.

Legacy:
- V2 relacional.
- V3 reported true/false.
- V6 boletas operacionales.
- V12 auxiliares inteligentes.

Exequias:
- V7 Exequias ↔ Bautismo fallecido.
Después de tocar estos módulos, preferir gates existentes en `scripts/`, `VERIFICAR_*.cmd` y `supabase/postflight/`.

---

# 27. OBSERVACIONES DE UI IMPORTANTES

Centro de Migración:
- debe mostrar parroquia propietaria obligatoria.
- INSBAUTI/INSCONFI importan todas las boletas.
- botón “Crear staging” fue corregido para contraste.
- botones deben tener texto visible.

Sentar Bautismo:
- pestañas ahora cuentan:
  - Individual (n)
  - Por Lote (n)
  - Reportadas / Historial (n)
- boleta legacy no encontrada: “Reportada · partida no localizada”.
- manual sentada: historial reimprimible.

Sentar Confirmación:
- misma filosofía.
- boleta manual restaurada: “Asentada · boleta conservada”.
- no confundir con partida importada real.

Panel:
- fechas Confirmación deben salir de celebration_date/feccon.

---

# 28. RIESGOS A VIGILAR EN V12

1. Build aún no ejecutado después de V12.
2. Imports no usados tras eliminar botones.
3. `getParrocoEnFecha` usa `parseDateSafe`; comprobar build/runtime.
4. Materialización de CIUDADES usa `context_id=parish_id`; confirmar que toda UI consulta ese mismo contexto.
5. Materialización de IGLESIAS por `parish_id,codigo`; códigos nulos requieren manejo.
6. Materialización OBISPOS depende de forma de normalized_data; el archivo enviado estaba vacío.
7. `bishop_tenures` necesita UI y probablemente updated_at trigger si se desea.
8. ParroquiaAjustes enlaza `/diocese/migration-center`; comprobar autorización/ruta para el rol desde el que se navegue.
9. No abrir importaciones directas a usuario Parroquia si la política final exige sólo Diócesis/Admin; la propiedad de la parroquia seleccionada sigue siendo obligatoria.
10. Materialización debe ser idempotente.

---

# 29. ESTILO DE TRABAJO DEL USUARIO

El usuario prefiere:
- ejecución directa;
- pocas preguntas redundantes;
- “adelante” significa continuar trabajando;
- reportes breves mientras se ejecuta;
- pasos mecánicos agrupados;
- configuraciones sensibles paso a paso;
- no hacerle repetir datos ya conocidos;
- no decir “100%” sin pruebas reales;
- si un error aparece, diagnosticar y corregir, no pedirle que programe.

Cuando haya acceso Remote Desktop:
hacer los cambios directamente.

---

# 30. PROMPT EXACTO PARA ABRIR EL PRÓXIMO CHAT

El usuario puede iniciar el siguiente chat con:

> Continúa SACRAMENTUM desde `C:\SACRAMENTUM\SACRAMENTUM_FINAL\SACRAMENTUM_CONTINUIDAD_DUENO_PROYECTO_2026-09-18.md`. Lee ese documento completo y toma posesión técnica del proyecto. No me repitas el contexto ni me preguntes qué sigue. Empieza directamente en “PUNTO EXACTO DE REANUDACIÓN”, ejecuta primero build/postflight V12 y continúa hasta conectar los Datos Auxiliares inteligentes a Bautismo, Confirmación, Matrimonio y Exequias, nuevos e históricos. Trabaja directamente en mi equipo y no deshagas las migraciones ya aprobadas.

---
# 31. CIERRE DE ESTE CORTE

Último trabajo ejecutado antes de documentar:
- V12 aplicada en Supabase, exit 0.
- Centro de Migración conectado a materialización de auxiliares.
- Ajustes sin importador.
- botones de importación retirados de seis Datos Auxiliares.
- hook común creado.
- motor de párroco por fecha creado.
- motor antiguo que fabricaba fechas de salida sustituido.

PRIMERA ACCIÓN DEL PRÓXIMO CHAT:
**NO seguir editando a ciegas. Ejecutar npm run build inmediatamente, corregir lo que salga y luego postflight V12.**

Después continuar con UI Obispos Titulares + conexión de los ocho formularios.

FIN DEL DOCUMENTO MAESTRO.

---
# 32. ACTUALIZACIÓN EJECUTADA · V13 AUTORIDAD TEMPORAL ESTRICTA

Este bloque SUPERA el antiguo “PUNTO EXACTO DE REANUDACIÓN” de las secciones 28–31.

Validaciones ejecutadas:
- `npm run build`: OK.
- último build: 3108 módulos, exit code 0.
- `node scripts/verify-auxiliary-intelligence-v12.mjs`: OK.
- proyecto Supabase enlazado confirmado: `foczofcmwampjvlfbsqn`.
- postflight V12 ejecutado.
- smoke V13 ejecutado con ROLLBACK.
- residue check posterior: cero filas SMOKE.

Hallazgo corregido:
- V12 podía marcar como ACTIVO al último párroco aunque su `fecha_salida` ya hubiese terminado.
- El directorio legacy documenta al último párroco entre 2021-01-11 y 2025-06-15.
- No existe una vigencia documentada posterior.
- Por tanto 2026 NO debe inventar Párroco actual.

Migración aplicada:
`supabase/applied-history/SACRAMENTUM_TEMPORAL_AUTHORITY_STRICT_V13.sql`

V13 deja estas reglas:
- `sacramentum_priest_at_date` devuelve autoridad sólo dentro de fecha_ingreso/fecha_salida.
- `sacramentum_bishop_at_date` devuelve titular sólo dentro de start_date/end_date.
- `sacramentum_recalculate_current_priest` no convierte el último histórico en actual si ya terminó su vigencia.
- 2003, 2010, 2018 y 2024 resuelven correctamente los párrocos históricos.
- 2026-09-18 devuelve Párroco actual = null.
- estado ACTIVO actual en la parroquia operativa = 0, coherente con los datos disponibles.

Cliente corregido:
- `src/hooks/useSacramentalAuxiliaries.js`: eliminado fallback a la última autoridad fuera de vigencia.
- `src/services/catalogsService.js`: eliminado fallback histórico incorrecto y fechas vacías ya no se convierten en 1900-01-01.
- Bautismo nuevo y Confirmación nueva ya no toman un ACTIVO viejo de localStorage.
- Formularios históricos limpian únicamente autocompletados automáticos al cambiar a una fecha sin autoridad vigente.
- datos escritos manualmente por el usuario se preservan.
- Confirmación usa historial de Obispos Titulares para sugerir Ministro por fecha.

Datos Auxiliares:
- pestaña “Obispos Titulares” ya existe mediante `BishopTenuresList.jsx`.
- no quedan rutas paralelas de importación en auxiliary/*.jsx.
- búsqueda final: 0 referencias a Import*Form, isImportOpen, modals.import o Upload.
- toda importación queda concentrada en Centro de Migración.

Pruebas transaccionales:
`supabase/postflight/SACRAMENTUM_AUXILIARY_V13_SMOKE.sql`
Resultado:
- manual_priest_smoke = OK
- bishop_tenure_smoke = OK
- imported_priest_materialization_smoke = OK
- termina obligatoriamente en ROLLBACK.

Residue check:
`supabase/postflight/SACRAMENTUM_AUXILIARY_V13_RESIDUE_CHECK.sql`
Resultado:
- smoke_priests = 0
- smoke_bishop_tenures = 0
- smoke_batches = 0
- smoke_rows = 0
- active_priests = 0
- current_priest = null

# 33. NUEVO PUNTO EXACTO DE REANUDACIÓN

La fase de centralización de importaciones + motor temporal + conexión base de Datos Auxiliares queda cerrada técnicamente.

Siguiente trabajo recomendado:
1. prueba visual/manual de Datos Auxiliares > Obispos Titulares;
2. prueba visual de Bautismo/Confirmación/Matrimonio/Exequias nuevos e históricos;
3. comprobar autocomplete de Ciudades/Iglesias con datos reales cuando existan lotes importados;
4. mantener la regla: no crear catálogos ficticios si la fuente no existe;
5. después continuar con el siguiente módulo funcional pendiente del proyecto.

NO volver a aplicar V12A como estaba originalmente: su función antigua seleccionaba el último párroco como ACTIVO aunque la vigencia hubiese terminado. V13 es la autoridad vigente.

FIN ACTUALIZACIÓN V13.

---
# 34. GATE FUNCIONAL V13 Y AUTOCOMPLETADO

Se creó:
`scripts/verify-auxiliary-intelligence-v13.mjs`

Valida automáticamente:
- vigencias estrictas sin fallback fuera de período;
- Párroco actual desde el motor auxiliar;
- autocomplete de ciudades, iglesias, sacerdotes y obispos;
- “Da Fe” protegido en registros actuales;
- autoridad histórica resuelta por fecha;
- Obispos Titulares presente;
- cero importadores residuales fuera del Centro de Migración.

Resultado ejecutado:
`SACRAMENTUM V13 · OK · formularios, vigencias, autocompletados y centralización verificados.`

Mejora adicional:
- `CityAutocomplete.jsx` ahora presenta sugerencias desde el PRIMER carácter escrito.
- continúa permitiendo texto libre cuando la opción no existe en catálogo.

Build posterior a este cambio:
- 3108 módulos transformados;
- exit code 0;
- bundle JS ~1.946 MB, gzip ~496 KB;
- sólo permanece warning no bloqueante de tamaño de chunk.

Este es el cierre técnico más reciente de Datos Auxiliares V13.

---
# 35. V14 · NOTIFICACIONES CANCILLERÍA + NOTIFICACIONES SACRAMENTALES

Solicitud funcional implementada:
1. Notificaciones Cancillería conserva las comunicaciones de decretos como leídas/sin leer.
2. La notificación más reciente siempre queda arriba; el estado de lectura ya NO altera el orden.
3. Se retiró el archivado desde la bandeja parroquial de Cancillería.
4. Al abrir una notificación se marca como leída y se navega al decreto EXACTO por ID:
   `/parish/decrees/:decreeId`.
5. La vista directa `ParishDecreeDetailPage.jsx` valida además que el decreto pertenezca a la parroquia autenticada.

Nueva sección superior del menú parroquial:
- Notificaciones Cancillería
- Notificaciones Sacramentales
- Bautismo
- Confirmación
- Matrimonio
- ...

El antiguo “Aviso Alerta” fue retirado del submenú Matrimonio.
Dentro de Matrimonio queda `Emitir Notificación` para originar la notificación matrimonial.
Las rutas históricas de aviso redirigen a:
`/parish/sacramental-notifications`.

## Flujo Notificaciones Sacramentales

Nueva página:
`src/pages/parish/SacramentalNotificationsPage.jsx`

Pestañas:
- Recibidas
- Confirmaciones de recibido

Estados de una notificación recibida:
- `sin_leer`
- `leida`
- `aceptada`

Regla:
- abrir/leer NO equivale a aceptar;
- aceptar es un acto explícito;
- al aceptar se conserva el procesamiento existente de la notificación matrimonial y la vinculación de nota marginal cuando corresponde;
- las notificaciones aceptadas permanecen en el historial.

Orden:
- siempre `createdAt DESC`;
- una notificación leída no desplaza una más reciente.


## Acuse institucional de recibido

Migración aplicada:
`supabase/applied-history/SACRAMENTUM_NOTIFICACIONES_SACRAMENTALES_V14.sql`

Cambios:
- `matrimonial_notifications.notification_type`, default `matrimonio`.
- `matrimonial_notification_recipients.receipt_document_number`.
- `receipt_payload`.
- `receipt_created_at`.
- `sender_read_at`.

RPC:
- `mark_sacramental_notification_read(uuid)`: sólo marca lectura en parroquia receptora.
- `mark_sacramental_receipt_read(uuid)`: sólo la parroquia emisora puede marcar leído el acuse.

Trigger:
- `trg_prepare_sacramental_receipt`
- función `sacramentum_prepare_sacramental_receipt()`.

Al pasar una notificación a `processed`:
- genera automáticamente un número `RNS-AAAA-######`;
- crea payload institucional del acuse;
- conserva notificación original;
- identifica parroquia emisora/receptora;
- conserva bautizado, partida vinculada y si se aplicó nota marginal;
- deja el acuse como no leído para el párroco emisor.

Documento UI:
`src/components/ModalVerAcuseSacramental.jsx`
- consulta;
- impresión;
- documento original vinculado;
- parroquia receptora;
- persona;
- Libro/Folio/Número cuando constan;
- estado de nota marginal.

El badge de Notificaciones Sacramentales suma:
- notificaciones recibidas pendientes de aceptación;
- acuses de recibido todavía no leídos por el emisor.

Los badges se refrescan en vivo mediante:
`sacramentum:notification-badge-refresh`.


## Pruebas V14

Postflight:
`supabase/postflight/SACRAMENTUM_NOTIFICACIONES_SACRAMENTALES_V14_POSTFLIGHT.sql`

Resultado:
- mark_read_rpc = true
- receipt_columns = 4
- receipt_trigger = true
- mark_receipt_rpc = true
- notification_type_column = true
- processed_without_receipt = 0

Smoke transaccional:
`supabase/postflight/SACRAMENTUM_NOTIFICACIONES_SACRAMENTALES_V14_SMOKE.sql`

Dentro de BEGIN/ROLLBACK:
- se creó notificación temporal;
- se creó destinatario temporal;
- se simuló aceptación;
- receipt_generated = 1;
- formato RNS validado.

Residue check:
`supabase/postflight/SACRAMENTUM_NOTIFICACIONES_SACRAMENTALES_V14_RESIDUE.sql`

Resultado posterior:
- smoke_notifications = 0
- smoke_recipients = 0

Gate:
`scripts/verify-notifications-v14.mjs`

Resultado:
`SACRAMENTUM V14 · OK · Cancillería, bandeja sacramental, lectura, aceptación y acuses verificados.`

Cierre conjunto:
- V13 OK.
- V14 OK.
- npm run build OK.
- 3109 módulos transformados.
- exit code 0.
- permanece únicamente warning no bloqueante de tamaño de bundle.

# 36. NUEVO PUNTO DE REANUDACIÓN

V14 queda implementada técnica y estructuralmente.

Siguiente acción recomendada:
1. abrir sesión real de Parroquia;
2. revisar visualmente Notificaciones Cancillería;
3. abrir un decreto real desde su notificación si existe;
4. revisar Notificaciones Sacramentales > Recibidas;
5. cuando exista una notificación real entre dos parroquias, aceptar desde la receptora y comprobar en la emisora el acuse RNS;
6. después continuar extendiendo `notification_type` a nuevos emisores sacramentales que se incorporen al sistema.

No volver a poner “Aviso Alerta” dentro de Matrimonio.
La bandeja canónica receptora es `/parish/sacramental-notifications`.

FIN ACTUALIZACIÓN V14.

---
# 37. V14B · GARANTÍA CENTRAL DE NOTIFICACIONES DE DECRETO

Durante la auditoría posterior a V14 se detectó una inconsistencia importante en la base enlazada:
- los RPC vigentes de Bautismo y Confirmación habían sido reemplazados por versiones posteriores que ya no contenían `insert into public.official_notifications`;
- Exequias y Matrimonio sí conservaban emisión explícita de notificación.

Resultado del auditor de funciones en la base real:
- apply_baptism_correction -> emits_official_notification=false
- apply_baptism_replacement -> false
- apply_confirmation_correction -> false
- apply_confirmation_replacement -> false
- apply_funeral_correction -> true
- apply_marriage_correction -> true
- apply_marriage_nullity -> true

Para evitar depender de cada RPC individual se creó una garantía central:

`supabase/applied-history/SACRAMENTUM_DECREE_NOTIFICATION_GUARANTEE_V14B.sql`

Función:
`public.sacramentum_emit_decree_notification()`

Constraint trigger:
`trg_decree_official_notification_guarantee`

Características:
- AFTER INSERT OR UPDATE sobre `public.decretos`;
- DEFERRABLE INITIALLY DEFERRED;
- al finalizar la transacción verifica si el decreto ya produjo comunicación;
- si el RPC ya la produjo, no duplica;
- si el RPC no la produjo, crea una sola `official_notifications`;
- respeta el índice único `(decree_id, receiver_parish_id, category)`;
- sólo actúa para decretos activos con parroquia;
- exige autoridad Cancillería/Diócesis/Admin o `chancery_id` institucional explícito;
- normaliza Bautismo, Confirmación, Matrimonio y Exequias;
- conserva decreeId, decreeNumber, decreeDate, sacramentType y decreeType.

Esto blinda futuros cambios de RPC: mientras el decreto llegue correctamente a `public.decretos`, la parroquia tendrá su notificación.

## Estado de datos reales al aplicar V14B

Auditoría:
- decretos_total = 0
- official_notifications_total = 0
- matrimonial_notifications_total = 0
- matrimonial_notification_recipients_total = 0

No hubo que ejecutar backfill histórico porque actualmente no existen decretos reales sin comunicación en la base enlazada.

## Smoke V14B por sacramento

Archivo:
`supabase/postflight/SACRAMENTUM_DECREE_NOTIFICATION_GUARANTEE_V14B_SMOKE.sql`

Se probaron dentro de BEGIN/ROLLBACK:
- Bautismo · corrección
- Confirmación · reposición
- Exequias · corrección
- Matrimonio · nulidad

Resultado:
- 4 decretos temporales
- 4 notificaciones oficiales
- 4 decree_id distintos
- todas status=pending
- todas vinculadas a la parroquia correcta

Después del ROLLBACK:
- smoke_decrees = 0
- smoke_notifications = 0


# 38. SMOKE AUTENTICADO COMPLETO V14

Archivo:
`supabase/postflight/SACRAMENTUM_V14_AUTHENTICATED_FLOW_SMOKE.sql`

La primera ejecución intentó crear el decreto bajo identidad parroquial y fue bloqueada correctamente por:
`sacramentum_guard_decree_authority()`
con el mensaje:
“Sólo Cancillería puede emitir o revertir decretos de corrección/reposición”.

Se corrigió el smoke para usar:
1. una identidad real de Cancillería activa para emitir el decreto;
2. una identidad real de Parroquia activa para leer la comunicación y procesar recepción.

Flujo transaccional validado:
- Cancillería emite decreto temporal;
- V14B genera notificación oficial;
- Parroquia marca la comunicación de Cancillería como leída;
- Parroquia abre notificación sacramental;
- Parroquia la marca leída;
- Parroquia acepta;
- `process_matrimonial_notification_recipient` procesa la recepción;
- trigger V14 genera acuse `RNS-AAAA-######`;
- parroquia emisora marca el acuse como leído.

Resultado:
- chancery_read_ok = true
- sacramental_read_ok = true
- acceptance_ok = true
- receipt_ok = true

Postflight final:
`supabase/postflight/SACRAMENTUM_V14_FINAL_POSTFLIGHT.sql`

Resultado:
- decree_notification_function = true
- decree_notification_trigger = true
- trigger_is_deferrable = true
- mark_official_read_rpc = true
- mark_sacramental_read_rpc = true
- mark_receipt_read_rpc = true
- smoke_auth_decrees = 0
- smoke_auth_official = 0
- smoke_auth_docs = 0
- smoke_auth_recipients = 0

# 39. LECTURA DIRECTA DEL DECRETO

Ruta:
`/parish/decrees/:decreeId`

Archivo:
`src/pages/parish/ParishDecreeDetailPage.jsx`

La página:
- exige sesión parroquial por ProtectedRoute;
- filtra además `decretos.id = decreeId` y `parish_id = user.parishId`;
- muestra número, fecha, sacramento, tipo, estado y titular;
- muestra fundamento/motivo;
- muestra ubicación de partida original;
- muestra ubicación de partida nueva/supletoria;
- muestra evidencia del expediente cuando existe;
- muestra notas marginales originales/resultantes;
- muestra datos escalares adicionales conservados en payload;
- permite imprimir el decreto;
- nunca abre un decreto ajeno a la parroquia.

Las rutas locales verificadas como navegación HTML:
- /parish/notifications -> 200
- /parish/sacramental-notifications -> 200
- /parish/decrees/:decreeId -> 200

Gate actualizado:
`scripts/verify-notifications-v14.mjs`

Cierre:
- SACRAMENTUM V14 · OK
- npm run build · OK
- 3109 módulos transformados
- exit code 0
- único warning: bundle >500 kB, no bloqueante.

PUNTO DE REANUDACIÓN:
La arquitectura de Notificaciones Cancillería + Notificaciones Sacramentales queda blindada tanto en UI como en Supabase.
El siguiente caso real que se ejecute desde Cancillería deberá aparecer automáticamente en la bandeja parroquial sin depender de un insert específico dentro del RPC sacramental.

---
# 40. V15 · NOTIFICACIONES SACRAMENTALES REALES MÁS ALLÁ DEL MATRIMONIO ORDINARIO

Se auditó qué flujos actuales vinculan una partida de Bautismo.

## Confirmación

La Confirmación tiene cruce hacia Bautismo y puede generar nota marginal.
Sin embargo, los RPC actuales únicamente permiten el cruce cuando la partida bautismal pertenece a la misma parroquia:
`b.parish_id = p_parish_id`.

Por tanto:
- Confirmación local -> aplicación local de la nota;
- actualmente NO existe un flujo de Confirmación interparroquial que requiera mensajería.

Regla futura:
si Confirmación permite localizar un Bautismo de otra parroquia, debe usar Notificaciones Sacramentales y nunca actualizarlo directamente.

## Nulidad matrimonial

Se detectó que `apply_marriage_nullity(...)` podía modificar directamente Bautismos de otras parroquias.
Esto era incompatible con la nueva regla solicitada:
- parroquia receptora recibe;
- lee;
- acepta;
- sólo entonces se aplica la nota;
- emisor recibe acuse.

Se creó y aplicó:

`supabase/applied-history/SACRAMENTUM_NOTIFICACIONES_SACRAMENTALES_NULIDAD_V15.sql`

### Nueva regla

Si el Bautismo afectado por nulidad pertenece a la MISMA parroquia del matrimonio:
- la nota `nulidad_matrimonial` se aplica localmente.

Si el Bautismo pertenece a OTRA parroquia:
- NO se modifica el Bautismo al ejecutar la nulidad;
- se genera Notificación Sacramental pendiente;
- documento: `NS-NUL-AAAA-######`;
- `notification_type = nulidad_matrimonial`;
- documento ligado a una sola partida bautismal;
- el párroco receptor puede leer sin aceptar;
- al aceptar se aplica la nota marginal;
- se crea acuse `RNS-AAAA-######`;
- la parroquia de origen puede abrir el acuse y marcarlo leído.

La notificación de Cancillería correspondiente al decreto matrimonial sigue siendo responsabilidad de V14B y no se duplica dentro del RPC de nulidad.

## Procesador sacramental generalizado

Por compatibilidad se conserva el nombre SQL:
`process_matrimonial_notification_recipient(uuid)`

Pero su comportamiento ya depende de `notification_type`.

Para `matrimonio`:
- note_type = matrimonio
- source_type = matrimonial_notification

Para `nulidad_matrimonial`:
- note_type = nulidad_matrimonial
- source_type = sacramental_notification

Además conserva en Baptismo:
- lastSacramentalNotificationId
- lastSacramentalNotificationType

El frontend usa desde V15 nombres semánticos:
- listSacramentalInbox
- getSacramentalDocument
- processSacramentalRecipient

Se conserva alias de compatibilidad para código matrimonial anterior.


# 41. V15 · DOCUMENTOS Y PRESENTACIÓN

Notificaciones Sacramentales distingue visualmente:

### Matrimonio
- etiqueta “Matrimonio”
- referencia de matrimonio y cónyuge
- documento matrimonial existente

### Nulidad matrimonial
- etiqueta “Nulidad matrimonial”
- referencia “Decreto/Sentencia …”
- fecha del decreto
- autoridad emisora “Cancillería Diocesana / Tribunal Eclesiástico”
- identificación de Bautizado(a)
- Libro/Folio/Número bautismal
- datos del matrimonio
- número y fecha de sentencia/decreto
- motivo/fundamento
- texto exacto de la Nota Marginal a Asentar

Archivos actualizados:
- src/services/matrimonialNotificationsService.js
- src/pages/parish/SacramentalNotificationsPage.jsx
- src/pages/parish/NotificacionMatrimonialPage.jsx
- src/components/TablaAvisos.jsx
- src/components/ModalVerAviso.jsx
- src/components/VistaImprimibleDocumento.jsx
- src/components/ModalVerAcuseSacramental.jsx

La pantalla específica “Emitir Notificación” de Matrimonio filtra únicamente:
`notificationType === matrimonio`

Esto impide que documentos generados por Cancillería por nulidad aparezcan mezclados dentro del archivo matrimonial parroquial.

El impreso también normaliza catálogos `name/nombre` y `city/ciudad`.

## Acuse V15

El payload RNS ahora conserva además:
- notificationType
- decreeId
- decreeNumber
- decreeDate
- reason
- marriageId
- baptism
- noteApplied

Para nulidad, la pantalla y el impreso del acuse muestran expresamente:
- Decreto / Sentencia
- Fecha del Decreto.


# 42. V15 · SEGURIDAD Y PRUEBAS

## Seguridad

Postflight:
`supabase/postflight/SACRAMENTUM_NOTIFICACIONES_SACRAMENTALES_V15_POSTFLIGHT.sql`

Resultado final:
- nullity_rpc = true
- nullity_helper = true
- generic_processor = true
- receipt_trigger_function = true
- authenticated_can_process = true
- authenticated_can_apply_nullity = true
- authenticated_cannot_call_internal_nullity_helper = true
- anon_cannot_call_internal_nullity_helper = true
- decree_guarantee_still_active = true
- receipt_trigger_still_active = true

El helper interno:
`sacramentum_issue_nullity_baptism_notification(...)`
NO puede ser invocado por anon/authenticated/service_role directamente.
Sólo se usa internamente desde el RPC de nulidad con SECURITY DEFINER.

`apply_marriage_nullity(...)` sí tiene EXECUTE para authenticated/service_role,
pero conserva validación interna de rol:
Cancillería / Diócesis / Administrador General.

## Smoke interparroquial

Archivo:
`supabase/postflight/SACRAMENTUM_NOTIFICACIONES_SACRAMENTALES_NULIDAD_V15_SMOKE.sql`

La base real al momento de prueba tiene:
- 1 parroquia
- 48 Bautismos
- 1 Matrimonio
- 1 usuario Cancillería activo
- 1 usuario Parroquia activo

Como no existen dos parroquias reales, el smoke crea dentro de BEGIN/ROLLBACK una parroquia temporal copiando Diócesis/Vicaría/Decanato de la parroquia operativa.
No se relaja la jerarquía territorial.

Flujo probado:
1. una partida bautismal real se mueve temporalmente a la parroquia temporal;
2. Cancillería ejecuta nulidad sobre el matrimonio real;
3. se comprueba que el Bautismo remoto NO cambió;
4. se crea NS-NUL pendiente;
5. el perfil parroquial real se sitúa temporalmente en la parroquia receptora;
6. lee la notificación;
7. la acepta;
8. entonces se aplica la nota nulidad_matrimonial;
9. marginal_notes conserva source_type=sacramental_notification;
10. se genera RNS;
11. RNS conserva decreeNumber y decreeDate;
12. perfil vuelve a parroquia original;
13. emisor lee el acuse;
14. ROLLBACK.

Resultado:
- remote_baptism_untouched_before_accept = true
- nullity_notification_created = true
- nullity_note_after_accept = true
- receipt_created_and_read = true

Residue:
`supabase/postflight/SACRAMENTUM_NOTIFICACIONES_SACRAMENTALES_NULIDAD_V15_RESIDUE.sql`

Resultado:
- temp_parish = 0
- baptisms_in_temp_parish = 0
- smoke_decrees = 0
- smoke_documents = 0
- smoke_recipients = 0
- smoke_notes = 0
- real_marriage_still_seated = true
- active_parish_user_back_home = true

Gate:
`scripts/verify-notifications-v15.mjs`

Resultado:
`SACRAMENTUM V15 · OK · nulidad interparroquial, aceptación, nota marginal, documento y acuse verificados.`

Cierre conjunto:
- V13 OK
- V14 OK
- V15 OK
- smoke V15 4/4
- residuos 0
- npm run build OK
- 3109 módulos
- exit code 0
- warning de bundle >500kB permanece no bloqueante.

# 43. REGLA CANÓNICA DE NOTIFICACIONES SACRAMENTALES

Desde V15:

NINGÚN flujo nuevo debe modificar una partida bautismal perteneciente a otra parroquia de forma silenciosa/directa.

Patrón obligatorio:
ACTO ORIGEN -> NOTIFICACIÓN SACRAMENTAL -> SIN LEER/LEÍDA -> ACEPTAR -> APLICAR NOTA -> ACUSE RNS -> LECTURA DEL EMISOR.

Excepción:
si la partida bautismal pertenece a la misma parroquia que origina legítimamente el acto, puede aplicarse localmente dentro de la misma transacción auditada.

FIN ACTUALIZACIÓN V15.

---
# 44. AUDITORÍA GLOBAL DE ESCRITORES SOBRE BAUTISMO · V15

Se auditó la definición VIGENTE de funciones PostgreSQL que contienen:
`UPDATE public.baptisms`.

Funciones detectadas:
- apply_baptism_correction_internal
- apply_marriage_nullity
- issue_matrimonial_notification
- process_matrimonial_notification_recipient
- reconcile_legacy_pre_registrations
- reconcile_legacy_pre_registrations_v2_internal
- register_historical_confirmation_internal
- reverse_correction_decree
- reverse_replacement_decree
- sacramentum_sync_baptism_death_from_funeral
- seat_confirmation_records

## Resultado por flujo sacramental

### Matrimonio
Ya implementa correctamente:
- nota local si Bautismo pertenece a parroquia emisora;
- Notificación Sacramental si el Bautismo pertenece a otra parroquia;
- aceptación por receptora;
- acuse RNS.

### Nulidad matrimonial
Corregido en V15:
- local si Bautismo es de la misma parroquia;
- NS-NUL si Bautismo es remoto;
- sin modificación remota antes de aceptar;
- RNS después de aceptar.

### Confirmación
Los RPC actuales obligan que el Bautismo cruzado pertenezca a la misma parroquia.
No existe hoy escritura interparroquial silenciosa.
Si en el futuro se habilita búsqueda/relación remota, deberá usar Notificaciones Sacramentales.

### Exequias
Función vigente:
`sacramentum_sync_baptism_death_from_funeral()`

Trigger:
`trg_sync_baptism_death_from_funeral`

La actualización siempre exige:
`baptism.id = funeral.baptism_id AND baptism.parish_id = funeral.parish_id`

Si no encuentra esa partida local, aborta con:
“No fue posible marcar la partida bautismal vinculada como fallecida”.

Por tanto Exequias NO modifica actualmente Bautismos de otras parroquias y no necesita notificación interparroquial en el diseño vigente.

### Correcciones/reversiones y reconciliación legacy
Son operaciones sobre el propio expediente/parroquia o tareas de gobierno/migración; no constituyen nuevos avisos sacramentales interparroquiales.

## Conclusión técnica vigente

A fecha de este corte, todos los flujos funcionales actuales que pueden afectar un Bautismo perteneciente a OTRA parroquia están cubiertos por el patrón de Notificaciones Sacramentales:
- Matrimonio
- Nulidad matrimonial

Confirmación y Exequias permanecen local-only.

Archivo de auditoría:
`supabase/postflight/SACRAMENTUM_BAPTISM_EXTERNAL_WRITERS_AUDIT_V15.sql`

FIN AUDITORÍA GLOBAL V15.


---
# 45. V16 · NOTIFICACIÓN MATRIMONIAL ROBUSTA · CIERRE 2026-09-18

Objetivo del usuario:
hacer la Notificación Matrimonial realmente funcional de extremo a extremo, no sólo visual.

## 45.1 Migración principal aplicada

Archivo:
`supabase/applied-history/SACRAMENTUM_NOTIFICACION_MATRIMONIAL_ROBUSTA_V16.sql`

Aplicada sobre proyecto Supabase enlazado:
`foczofcmwampjvlfbsqn`

Resultado de aplicación:
- exit code 0.

### Seguridad RLS corregida

Hallazgo crítico previo a V16:
- `matrimonial_notifications`: RLS=true pero 0 policies.
- `matrimonial_notification_recipients`: RLS=true pero 0 policies.
- ninguna de las dos tablas estaba en `supabase_realtime`.

V16 crea:
- `can_read_matrimonial_notification(uuid)`
- `can_read_matrimonial_recipient(uuid)`
- policy `matrimonial_notifications_select_scoped`
- policy `matrimonial_recipients_select_scoped`

Regla:
- Parroquia emisora ve sus expedientes.
- Parroquia receptora ve sólo los destinados a ella.
- Diócesis/Cancillería se restringen a su jurisdicción mediante `can_access_parish`.
- Admin General conserva acceso institucional.
- UPDATE/INSERT/DELETE directo desde authenticated queda revocado; los cambios operativos pasan por RPC.

### Realtime

Añadidas a `supabase_realtime`:
- `public.matrimonial_notifications`
- `public.matrimonial_notification_recipients`

Frontend conectado a Realtime en:
- Archivo de Envíos matrimonial.
- Bandeja `Notificaciones Sacramentales`.
- badge del Sidebar.

Servicio:
`src/services/matrimonialNotificationsService.js`

Suscripción:
`subscribeToSacramentalNotificationActivity(...)`

## 45.2 Regla institucional de origen del Matrimonio

El RPC `issue_matrimonial_notification(...)` ahora deriva la identidad institucional desde la sesión autenticada.

Regla obligatoria:
LA PARROQUIA EMISORA ES LA PARROQUIA DONDE CONSTA EL MATRIMONIO.

El cliente no puede atribuir la celebración a otra parroquia ni a otra diócesis.

Bloqueos:
- fecha futura;
- Libro matrimonial vacío;
- Folio matrimonial vacío;
- Número matrimonial vacío;
- parroquia matrimonial diferente de la emisora;
- diócesis matrimonial diferente de la diócesis real de la emisora.

Si Libro/Folio/Número/fecha coinciden con una partida digital de `marriages`, se congela:
- `marriage_id`
- `marriageRecordLinked=true`
- `marriageSource=digital_registry`

Si no existe la partida digital:
- no se inventa vínculo;
- queda `marriageRecordLinked=false`
- `marriageSource=physical_reference`.

## 45.3 Bautismos digitales y modo manual

### Digital
Se exigen:
- partida principal;
- partida del cónyuge;
- ambas distintas;
- ambas vigentes;
- ambas dentro de la diócesis autorizada.

La búsqueda digital puede localizar Bautismos de la diócesis/arquidiócesis y no queda restringida a la parroquia emisora.

### Manual
Uso previsto:
partida existente en libro físico pero todavía no digitalizada.

Obligatorios:
- nombres;
- apellidos;
- parroquia destinataria;
- Libro Bautismo;
- Folio Bautismo;
- Número Bautismo;
- cónyuge;
- fecha Matrimonio;
- Libro/Folio/Número Matrimonio.

La parroquia manual destinataria debe pertenecer a la diócesis autorizada.

## 45.4 Duplicidad correcta

Se eliminó el criterio anterior:
“la persona ya tiene cónyuge”.

Ese criterio era inválido como bloqueo canónico/técnico porque una persona puede tener un expediente matrimonial posterior legítimo.

Nueva regla:
se bloquea el MISMO EXPEDIENTE por combinación de:
- las dos partidas bautismales;
- fecha Matrimonio;
- Libro Matrimonio;
- Folio Matrimonio;
- Número Matrimonio.

Índice:
`uq_active_matrimonial_digital_case_v16`

Usa:
- `least(source_baptism_id,spouse_baptism_id)`
- `greatest(source_baptism_id,spouse_baptism_id)`

Por tanto:
A+B y B+A se consideran el mismo expediente.

Frontend:
`src/utils/matrimonialNotificationValidation.js`
función:
`validarNotificacionMatrimonialDuplicada(...)`

La función vieja `validarPersonaNoTieneConyuge` fue eliminada por completo.

## 45.5 Entrega local, remota y mixta

El expediente registra:
- `recipientsCreated`
- `localNotesApplied`
- `deliveryMode`

Modos:
- `local`
- `remote`
- `mixed`

Regla:
- Bautismo de la misma parroquia emisora: nota local dentro de la transacción auditada.
- Bautismo de otra parroquia: NO se modifica hasta que la parroquia receptora acepte la notificación.
- un mismo Matrimonio puede producir simultáneamente una nota local y un aviso remoto.

## 45.6 Documento inmutable / snapshots

El expediente maestro congela:
- `sourceBaptism`
- `spouseBaptism`
- `mainMarginalNote`
- `spouseMarginalNote`
- `issuerAuthority`
- datos de Matrimonio;
- identidad de parroquia/diócesis emisora;
- vínculo o referencia física matrimonial.

Esto evita reconstruir el documento meses después usando datos actuales distintos.

Frontend:
`mapDocument(...)` transforma snapshots a:
- baptismBook
- baptismFolio
- baptismNumber
- baptismParishId
- baptismParishName
- marginNoteText
- spouseMarginNoteText

Para cada destinatario:
`listMatrimonialInbox(...)`
construye un documento específico por `partyRole`.

Si el destinatario corresponde al cónyuge:
- ese cónyuge pasa a ser el bautizado/persona del documento;
- el contrayente principal se muestra como cónyuge;
- se usa SU snapshot bautismal;
- se usa SU nota marginal.

## 45.7 Autoridad que da fe

Componentes auditados/corregidos:
- `ModalVerDocumento.jsx`
- `VistaImprimibleDocumentoRespaldo.jsx`
- `ModalVerAviso.jsx`
- `VistaImprimibleDocumento.jsx`

Todos prefieren:
`issuerAuthority` congelado al emitir.

Fallback permitido:
sólo sacerdote cuya vigencia documental contenga exactamente la fecha del documento.

Eliminado:
fallback al sacerdote `estado=1`.

Si no existe autoridad documentada:
`PÁRROCO / ENCARGADO NO DOCUMENTADO PARA LA FECHA`

No se fabrica un nombre.

## 45.8 Cancelación segura

`cancel_matrimonial_notification(uuid)`

Puede cancelar:
- expediente pendiente;
- sin notas aplicadas;
- sin receptores procesados;
- sin RNS.

NO puede cancelar si:
- estado processed;
- existe receptor processed;
- `note_applied=true`;
- existe `receipt_document_number`;
- existe marginal_note activa proveniente del expediente.

Mensaje:
“La notificación ya produjo efectos sacramentales o fue aceptada; no puede cancelarse. Debe tramitarse la corrección correspondiente.”

La cancelación válida conserva auditoría y:
- `cancelled_at`
- `cancelled_by`.

## 45.9 Archivo de Envíos

Estados visibles:
- Pendiente de recepción
- Recepción parcial
- Recibida
- Aplicada localmente
- Cancelada

Filtros actualizados a esos estados.

El botón Cancelar queda deshabilitado cuando `canCancel=false`.

El visor muestra:
- parroquia emisora;
- una o varias parroquias receptoras;
- fuente digital/física del Matrimonio;
- autoridad documentada;
- Bautismo Libro/Folio/Número;
- Matrimonio Libro/Folio/Número;
- nota exacta congelada.

`emisorInfo` y `receptorInfo` ya se pasan desde:
`NotificacionMatrimonialPage.jsx`
a:
`ModalVerDocumento.jsx`.

## 45.10 Confirmación posterior a emisión

`ConfirmacionNotificacion.jsx`

Ya no afirma siempre “enviada a parroquia destinataria”.

Ahora informa según:
- local;
- remote;
- mixed.

Muestra:
- consecutivo NM;
- persona;
- cónyuge;
- fecha;
- cantidad de destinatarios remotos;
- cantidad de notas locales;
- origen matrimonial digital o físico.

## 45.11 Smoke E2E V16

Archivo:
`supabase/postflight/SACRAMENTUM_NOTIFICACION_MATRIMONIAL_V16_SMOKE.sql`

Todo dentro de:
`BEGIN ... ROLLBACK`

Utiliza:
- identidad parroquial real;
- Bautismos reales;
- Matrimonio real;
- parroquia receptora temporal;
- tercera parroquia temporal para aislamiento RLS.

Resultado final: 13/13 verdadero.

- mixed_delivery = true
- marriage_linked = true
- receipt_created = true
- origin_spoof_blocked = true
- rls_sender_visibility = true
- third_party_isolation = true
- rls_receiver_visibility = true
- pending_manual_cancelled = true
- remote_note_after_accept = true
- snapshot_notes_preserved = true
- reverse_duplicate_blocked = true
- accepted_cancellation_blocked = true
- remote_untouched_before_accept = true

Flujo probado:
1. emisor crea expediente;
2. una nota se aplica local;
3. Bautismo remoto permanece intacto;
4. receptora puede leer sólo lo suyo;
5. tercera parroquia no puede leer documento ni destinatario;
6. receptora marca leído;
7. receptora acepta;
8. entonces se aplica nota remota;
9. se genera RNS;
10. emisor puede leer RNS;
11. duplicado invertido queda bloqueado;
12. origen matrimonial falsificado queda bloqueado;
13. expediente con efectos no puede cancelarse;
14. expediente manual todavía pendiente sí puede cancelarse;
15. ROLLBACK completo.

## 45.12 Postflight final / residuos

Archivo:
`supabase/postflight/SACRAMENTUM_NOTIFICACION_MATRIMONIAL_V16_FINAL.sql`

Resultado:
- notification_rls_policy_ok = true
- recipient_rls_policy_ok = true
- notifications_realtime_ok = true
- recipients_realtime_ok = true
- issue_rpc_ok = true
- process_rpc_ok = true
- read_rpc_ok = true
- receipt_read_rpc_ok = true
- direct_doc_update_blocked = true
- direct_recipient_update_blocked = true
- smoke_documents = 0
- smoke_marginal_notes = 0
- smoke_parishes = 0
- user_profile_restored = true
- baptism_restored = true
- live_matrimonial_documents = 0
- live_matrimonial_recipients = 0

A este corte todavía NO existen expedientes matrimoniales reales en las tablas nuevas.
Por tanto no afirmar prueba visual con datos productivos reales.

## 45.13 Gates

V14:
`node scripts/verify-notifications-v14.mjs`

Resultado:
`SACRAMENTUM V14 · OK · Cancillería, bandeja sacramental, lectura, aceptación y acuses verificados.`

V16:
`node scripts/verify-matrimonial-notifications-v16.mjs`

Resultado:
`SACRAMENTUM V16 MATRIMONIAL · OK · 40/40 controles estáticos.`

## 45.14 Build final

Log:
`supabase/postflight/SACRAMENTUM_V16_BUILD.log`

Resultado:
- Vite 4.5.5
- 3109 modules transformed
- CSS 113.21 kB / gzip 18.31 kB
- JS 1,975.44 kB / gzip 504.40 kB
- built in 16.50s
- BUILD_EXIT:0

Warnings no bloqueantes:
- caniuse-lite 21 months old;
- chunk principal >500 kB.

## 45.15 Rutas SPA verificadas

Con Accept de navegación HTML:
- `/parroquia/matrimonio/notificacion` -> HTTP 200
- `/parish/sacramental-notifications` -> HTTP 200
- `/parish/notifications` -> HTTP 200

Cada respuesta:
- content-type text/html
- 30561 bytes.

Esto verifica fallback/ruteo SPA.
NO equivale a una prueba visual autenticada cross-session con datos reales.

## 45.16 Punto exacto de reentrada

La infraestructura matrimonial V16 queda cerrada a nivel:
- base de datos;
- permisos;
- RLS;
- Realtime;
- emisión;
- aplicación local;
- recepción;
- lectura;
- aceptación;
- nota marginal;
- acuse RNS;
- cancelación segura;
- snapshots;
- documentos;
- estados de Archivo;
- gates;
- smoke;
- build.

Siguiente prueba operacional recomendada cuando exista el primer caso real:
1. emitir desde una parroquia real;
2. abrir una segunda sesión autenticada de la parroquia bautismal receptora;
3. comprobar llegada Realtime sin refresh;
4. leer;
5. aceptar;
6. verificar nota marginal real;
7. verificar RNS en la sesión emisora;
8. imprimir documento original y acuse;
9. confirmar trazabilidad en registry_audit_log.

No crear datos ficticios persistentes sólo para demostrar visualmente el flujo.

FIN ACTUALIZACIÓN V16 · NOTIFICACIÓN MATRIMONIAL ROBUSTA.

---
# 46. V16B · AUDITORÍA COMPLETA DE LECTURAS

Archivo aplicado:
`supabase/applied-history/SACRAMENTUM_NOTIFICACION_MATRIMONIAL_AUDITORIA_V16B.sql`

Se detectó que:
- emisión sí auditaba;
- aceptación sí auditaba;
- cancelación sí auditaba;
- lectura receptora NO auditaba;
- lectura del RNS por el emisor NO auditaba.

V16B corrige:
- `mark_sacramental_notification_read(uuid)`
  - registra `read_sacramental_notification`;
  - actor_user_id;
  - parish_id;
  - diocese_id;
  - notification_id;
  - document_number;
  - notification_type;
  - sender_parish_id;
  - receiver_parish_id;
  - target_baptism_id.
- `mark_sacramental_receipt_read(uuid)`
  - registra `read_sacramental_receipt`;
  - actor;
  - parroquia emisora;
  - RNS;
  - documento original;
  - parroquia receptora.

Ambos son idempotentes:
la auditoría sólo se crea cuando el timestamp de lectura estaba previamente NULL.
Abrir dos veces no duplica evidencia.

# 47. V16C · CIERRE REAL DEL MODO MANUAL

Hallazgo crítico:
una notificación manual podía emitirse con target_baptism_id=NULL.
El procesador histórico permitía marcarla processed con note_applied=false.
Esto podía generar la apariencia de una recepción completa sin evidencia de asiento de nota.

Archivo aplicado:
`supabase/applied-history/SACRAMENTUM_NOTIFICACION_MATRIMONIAL_MANUAL_V16C.sql`

## Guardia obligatoria

Trigger:
`trg_guard_manual_recipient_processing`

Función:
`sacramentum_guard_manual_recipient_processing()`

Regla:
un destinatario NO puede pasar a processed con target_baptism_id=NULL
salvo que su payload contenga:
`physicalNoteCertified=true`.

Mensaje:
“La notificación manual debe vincular una partida digital o certificar el asiento físico antes de aceptar”.

## Camino 1 · partida ya digitalizada

RPC:
`resolve_manual_matrimonial_notification_recipient(recipient_id,baptism_id)`

Valida:
- sesión parroquial activa;
- destinatario pertenece a la parroquia;
- expediente pendiente;
- Bautismo pertenece a esa parroquia;
- Bautismo vigente;
- Libro exacto;
- Folio exacto;
- Número exacto.

Al resolver:
- target_baptism_id queda asignado;
- baptismSnapshot queda congelado;
- manualResolvedAt;
- manualResolvedBy;
- acceptanceMode=digital_link;
- auditoría `resolve_manual_baptism`.

Luego se usa la aceptación normal y la nota se aplica digitalmente.

## Camino 2 · partida permanece física

RPC:
`process_manual_matrimonial_notification_physical(recipient_id)`

Sólo se usa cuando:
- no existe target_baptism_id;
- Libro/Folio/Número manuales están completos;
- el receptor certifica explícitamente que localizó la partida física y asentó la nota.

Efectos:
- status=processed;
- note_applied=true;
- physicalNoteCertified=true;
- physicalCertifiedAt;
- physicalCertifiedBy;
- acceptanceMode=physical_book;
- RNS automático;
- auditoría `process_physical_book`.

NO crea una partida digital ficticia.
NO inventa un target_baptism_id.

## UI receptora

Nuevos cambios:
- `ModalVincularPartidaNotificacion.jsx`
- `BusquedaPartidaBautismo.jsx`
- `SacramentalNotificationsPage.jsx`
- `ModalVerAviso.jsx`
- `TablaAvisos.jsx`

La bandeja muestra:
“Resolver” en vez de “Aceptar”
cuando la referencia sigue física/no resuelta.

Dentro del documento:
- Vincular partida digital
- Certificar asiento físico

La búsqueda de resolución:
- queda restringida a la parroquia receptora;
- Libro/Folio/Número vienen bloqueados;
- no permite cambiar la referencia;
- el RPC vuelve a verificar todo en servidor.

# 48. RNS Y SEGUIMIENTO POR DESTINATARIO

`ModalVerAcuseSacramental.jsx` distingue:
- digital_registry = Partida digital
- digital_link = Partida manual vinculada al registro digital
- physical_book = Libro físico · asiento certificado

El RNS muestra:
- modo de recepción;
- estado de la nota marginal;
- Libro/Folio/Número;
- parroquia receptora;
- documento original;
- fecha de recepción.

El Archivo de Envíos:
`ModalVerDocumento.jsx`

incluye “Seguimiento de recepción por parroquia”:
- parroquia;
- parte afectada (principal/cónyuge);
- Sin leer / Leída / Aceptada / Cancelada;
- fecha de lectura;
- fecha de aceptación;
- nota aplicada;
- RNS;
- fecha RNS;
- fecha en que el emisor leyó el acuse.

Servicio:
`listSentMatrimonialNotifications(...)`
expone `recipientTracking`.

# 49. PRUEBAS V16B / V16C

Gate:
`node scripts/verify-matrimonial-notifications-v16c.mjs`

Resultado:
`SACRAMENTUM V16C · OK · 29/29 controles.`

Smoke manual:
`supabase/postflight/SACRAMENTUM_NOTIFICACION_MATRIMONIAL_V16C_SMOKE.sql`

Resultado 8/8:
- digital_manual_resolved = true
- digital_note_applied = true
- digital_receipt_created = true
- physical_standard_blocked = true
- physical_certified = true
- physical_receipt_created = true
- resolution_audited = true
- physical_acceptance_audited = true

El smoke V16 general además verifica:
- lectura receptora auditada exactamente una vez;
- lectura RNS auditada exactamente una vez;
- llamadas repetidas son idempotentes.

Postflight:
`supabase/postflight/SACRAMENTUM_NOTIFICACION_MATRIMONIAL_V16C_FLAGS.sql`

Todo TRUE:
- resolve_manual_rpc
- physical_process_rpc
- mark_read_rpc
- mark_receipt_rpc
- authenticated_can_resolve
- authenticated_can_process_physical
- manual_guard_trigger
- receipt_trigger
- receiver_read_audited
- receipt_read_audited
- documents_realtime
- recipients_realtime

# 50. REGRESIÓN FINAL DEL CORTE

Ejecución conjunta:
- V14 OK
- V16 40/40
- V16C 29/29
- smoke V16 OK
- smoke V16C 8/8
- build OK

Build:
- Vite 4.5.5
- 3110 modules transformed
- JS 1,985.48 kB
- gzip 507.10 kB
- built in 24.33s
- FINAL_EXIT:0

Warnings no bloqueantes:
- caniuse-lite desactualizado;
- chunk principal >500 kB.

Residuos:
- smoke_parishes=0
- smoke_documents=0
- smoke_notes=0
- user_profile_restored=true
- baptism_restored=true
- live_matrimonial_documents=0
- live_matrimonial_recipients=0

Rutas verificadas:
- /parroquia/matrimonio/notificacion -> HTTP 200
- /parish/sacramental-notifications -> HTTP 200

Punto actual:
la Notificación Matrimonial cubre emisión digital/manual, local/remota/mixta,
lectura, resolución manual, aceptación digital, certificación física,
nota marginal, RNS, Realtime, auditoría, cancelación segura y seguimiento
por parroquia destinataria.

FIN CORTE V16B/V16C.

---
# 51. V17 · MATRIMON + NTMAT002 · CONEXIÓN HISTÓRICA

Solicitud del usuario:
tener especialmente presentes los archivos de importación de Matrimonio y, sobre todo, las notas históricas, garantizando una conexión correcta.

Archivos recibidos y analizados completos:
- `MATRIMON(1).json`
  - 348 filas
  - SHA-256: `31025e9f784ca07cb7c39b2d5da9971f703b85c0a8fb77a86c2f0847ea8a16c9`
- `NTMAT002.json`
  - 76 filas
  - SHA-256: `02fb6d103392c676cb58fb9ff852cd1a7ad9b925887b13124f690ee68d1907ff`

Cruce exacto por:
`Libro + Folio + Número`

Resultado sobre estos dos archivos concretos:
- 13 notas encuentran exactamente una partida en MATRIMON(1);
- 63 notas no tienen todavía su partida dentro de este lote;
- 0 notas tienen referencia ambigua;
- 0 referencias matrimoniales válidas están duplicadas;
- 1 fila MATRIMON carece de Libro y requiere revisión física.

Regla:
LAS 63 NOTAS SIN PARTIDA NO SE DESCARTAN NI SE FUERZAN.
Quedan en cola histórica esperando que llegue/importemos la partida correspondiente.

# 52. SEMÁNTICA DE NTMAT

Campos fuente:
- libro
- folio
- numero
- nota
- dafe
- actualizad

Reglas V17:
1. `nota` es texto histórico autoritativo y se conserva literalmente.
2. La clasificación automática es AUXILIAR; nunca reemplaza el texto.
3. La clasificación NO cambia automáticamente el estado del Matrimonio.
4. Una frase de nulidad puede referirse incluso a un matrimonio anterior; no inferir status=annulled.
5. `dafe` se conserva como código documental legacy.
6. `actualizad` es timestamp de actualización de la base antigua.
7. `actualizad` NO se convierte en fecha jurídica/sacramental de la nota.
8. Si la fecha histórica real no está explícitamente estructurada, `marginal_notes.note_date` queda NULL.

Clasificación auxiliar detectada en NTMAT002:
- nihil_obstat: 40
- nulidad_referida: 24
- disparidad_mixta: 7
- otra: 3
- restriccion_observacion: 1
- confirmacion_referida: 1

La clasificación sirve para búsqueda/revisión, no para alterar hechos sacramentales.

# 53. INFRAESTRUCTURA V17 APLICADA

Archivo:
`supabase/applied-history/SACRAMENTUM_LEGACY_MATRIMONIAL_NOTES_V17.sql`

Aplicado al proyecto:
`foczofcmwampjvlfbsqn`

Resultado:
exit code 0.

Crea/ajusta:
- perfiles Supabase `NTMAT001` y `NTMAT002`;
- tabla `legacy_marginal_note_queue`;
- RLS de cola histórica;
- índice exacto por parroquia + Libro/Folio/Número;
- índice idempotente de nota materializada;
- `marginal_notes.note_date` nullable;
- RPC `reconcile_legacy_matrimonial_notes(uuid)`;
- RPC `apply_legacy_marginal_note_batch(uuid,integer)`.

Estados de cola:
- pending
- matched
- ambiguous
- error

No hay inserción directa desde navegador a la cola.

# 54. CONCILIACIÓN DE NOTAS

`reconcile_legacy_matrimonial_notes(parish_id)`

Busca exclusivamente:
- misma parroquia propietaria;
- Libro normalizado exacto;
- Folio normalizado exacto;
- Número normalizado exacto.

Resultado:
- 1 matrimonio → matched + marginal_note materializada;
- 0 matrimonios → pending;
- >1 matrimonio → ambiguous, sin aplicar nota.

Nota materializada:
- sacrament_type=matrimonio;
- note_type=legacy_historical;
- content = texto literal del JSON;
- source_type=legacy_matrimonial_note;
- source_id = fila de cola;
- note_date=NULL cuando no existe fecha histórica documentada;
- is_locked=true;
- print_policy=internal;
- print_default=false;
- print_label=Nota histórica importada.

`legacy_source` conserva:
- profile_key;
- SHA;
- source_key;
- lote/fila;
- legacy_dafe_code;
- source_updated_at;
- classification;
- historical_note_date_unknown=true;
- original_data completo.

La nota histórica no se autoimprime en certificados hasta que una regla documental posterior determine que corresponde.

# 55. ORDEN DE IMPORTACIÓN SEGURO

El orden ya no importa:

CASO A:
1. importar MATRIMON;
2. importar NTMAT002;
3. NTMAT concilia inmediatamente.

CASO B:
1. importar NTMAT002;
2. notas sin partida quedan pending;
3. importar MATRIMON después;
4. `legacyMigrationService.applyLegacyBatch` vuelve a llamar automáticamente
   `reconcile_legacy_matrimonial_notes`;
5. notas que ya tienen partida pasan a matched.

Esto evita perder notas cuando los archivos históricos llegan en momentos diferentes.

Servicio:
`src/services/legacyMigrationService.js`

- NTMAT001/2 usa `apply_legacy_marginal_note_batch`.
- MATRIMON usa importador normal y luego relanza conciliación de notas.

# 56. CENTRO DE MIGRACIÓN · UI V17

Archivo:
`src/pages/admin/LegacyMigrationCenterPage.jsx`

Ahora:
- reconoce NTMAT001/NTMAT002;
- destino visible: “Notas históricas / marginales”;
- informa política de conservación literal;
- explica vínculo Libro + Folio + Número;
- informa que `actualizad` no es fecha jurídica;
- muestra clasificación auxiliar del lote;
- después de aplicar muestra:
  - Notas enlazadas
  - En espera de partida
  - Referencias ambiguas

Rutas:
- /admin/migration-center -> HTTP 200
- /diocese/migration-center -> HTTP 200

`src/config/legacyImportProfiles.js`:
- `MATRIMON(1).json` normaliza/detecta como MATRIMON;
- `NTMAT002.json` detecta NTMAT002;
- estructura NTMAT renombrada también puede detectarse por campos.

# 57. FECHA Y PRESENTACIÓN DE NOTAS HISTÓRICAS

Archivo:
`src/components/MarginalNotesRecordPanel.jsx`

Para `source_type=legacy_matrimonial_note`:
NO muestra `actualizad` como “fecha de nota”.

Muestra:
- “Base antigua actualizada: YYYY-MM-DD · fecha histórica de la nota no documentada”
o
- “Fecha histórica de la nota no documentada”.

Esto preserva la diferencia entre:
- fecha jurídica/sacramental;
- timestamp técnico de actualización del sistema viejo.

# 58. PRUEBAS V17

Gate:
`node scripts/verify-legacy-matrimonial-notes-v17.mjs`

Resultado:
`SACRAMENTUM V17 · OK · 25/25 controles.`

Smoke:
`supabase/postflight/SACRAMENTUM_LEGACY_MATRIMONIAL_NOTES_V17_SMOKE.sql`

BEGIN/ROLLBACK:
- creó lote NTMAT002 realista;
- nota 0001/0001/0001 encontró matrimonio real;
- texto quedó literal;
- note_date quedó NULL;
- dafe quedó preservado;
- nota quedó locked/internal;
- segunda nota 0099/0099/0099 quedó pending;
- se creó después un matrimonio temporal 0099/0099/0099;
- reconciliación posterior la vinculó;
- reejecución no duplicó nota;
- ROLLBACK completo.

Resultado:
- profile_registered=true
- existing_marriage_note_matched=true
- text_preserved_verbatim=true
- historical_date_not_invented=true
- unmatched_note_queued=true
- late_marriage_auto_reconciled=true
- reconciliation_idempotent=true

# 59. POSTFLIGHT / REGRESIÓN V17

Postflight:
- NTMAT001/NTMAT002 activos=true
- queue_table_ok=true
- reconcile_rpc_ok=true
- apply_rpc_ok=true
- permisos authenticated=true
- note_date nullable=true
- índice idempotencia=true
- índice referencia cola=true

Residuos:
- smoke_queue_rows=0
- smoke_notes=0
- smoke_marriages=0
- smoke_batches=0
- real_marriage_unchanged=true
- live_queue_rows=0
- live_linked_legacy_marriage_notes=0

Regresión:
- V14 OK
- V16 40/40
- V16C 29/29
- V17 25/25
- smoke V17 OK
- build FINAL_EXIT:0

Build:
- Vite 4.5.5
- 3110 módulos
- CSS 113.77 kB / gzip 18.39 kB
- JS 1,990.16 kB / gzip 508.18 kB
- built in 38.22s

Warnings no bloqueantes:
- caniuse-lite 21 months old;
- chunk >500 kB.

IMPORTANTE:
Los archivos subidos fueron analizados y el sistema quedó preparado,
pero sus 348 matrimonios y 76 notas NO fueron persistidos en producción
durante este corte. No importar datos históricos reales sin seleccionar
con certeza la parroquia propietaria y revisar la fila MATRIMON sin Libro.

FIN CORTE V17.

---
# 60. V18 · IMPORTACIÓN DE PÁRROCOS VISIBLE EN DATOS AUXILIARES

Incidencia real reportada:
- Centro de Migración mostraba PARROCOS.json · 4 filas · importación exitosa.
- Usuario Parroquia abría Datos Auxiliares > Párrocos y veía 0 registros.

Diagnóstico confirmado:
- lote PARROCOS: imported_count=4, error_count=0, status=completed;
- auditoría auxiliary_catalog_materialized: materialized=4;
- public.legacy_priest_directory=4;
- public.parrocos=4 para parroquia ada2c810-c6eb-4b75-8e3c-4941e3022687;
- RLS estaba enabled en parrocos pero existían 0 policies;
- sesión parroquial real veía 0 filas;
- ParrocosList.jsx además descartaba columnas reales y tomaba casi sólo payload.

Datos materializados correctos:
0001 · PBRO. ROBERTO PADILLA MARTÍNEZ · 2000-08-15 → 2005-12-20
0002 · PBRO. SANTIAGO MARTÍNEZ FUENTES · 2005-12-21 → 2012-01-29
0003 · PBRO. TEODORO GARCÍA GARCÍA · 2012-01-30 → 2021-01-10
0004 · PBRO. JAIDER HERRERA TURIZO · 2021-01-11 → 2025-06-15

Regla V13 preservada:
en 2026 no existe párroco actual documentado; los cuatro quedan HISTÓRICOS.
No inventar vigencia después del 2025-06-15.

Migración aplicada:
supabase/applied-history/SACRAMENTUM_AUXILIARY_RLS_VISIBILITY_V18.sql

V18:
- revoca acceso anon a parrocos, iglesias, ciudades, obispos, diocesis, mis_datos;
- SELECT autenticado usa ámbito institucional;
- Parroquia puede leer/escribir sólo su propio ámbito;
- Diócesis/Cancillería pueden leer sólo parroquias de su diócesis mediante can_access_parish;
- escrituras directas de catálogos quedan limitadas a admin_general o parroquia propietaria;
- materialización por Centro de Migración continúa mediante RPC security definer.

Frontend:
src/pages/parish/auxiliary/ParrocosList.jsx
- usa columnas reales de public.parrocos;
- conserva payload sólo como metadata;
- usa payload.legacy_code como Cód. Da Fe real;
- fechaIngreso ← fecha_ingreso;
- fechaSalida ← fecha_salida;
- estado ← estado real.

src/services/catalogsService.js:
- cache normalizada conserva columnas reales y legacyCode.

Centro de Migración:
- perfiles auxiliares ya no muestran éxito genérico;
- éxito: “Importación y publicación completadas”;
- informa X filas importadas y X visibles en Datos Auxiliares;
- si materialized != imported muestra alerta de materialización incompleta.

Pruebas:
- antes V18: sesión parroquial visible_parrocos=0;
- después V18: visible_parrocos=4;
- códigos visibles: 0001,0002,0003,0004;
- foreign_scope_access=false;
- escritura propia permitida dentro de ROLLBACK;
- otros catálogos actuales: iglesias=0, ciudades=0, obispos=0, diocesis_aux=0, mis_datos=0.

Gate:
node scripts/verify-auxiliary-visibility-v18.mjs
SACRAMENTUM V18 · OK · 17/17.

Regresión:
- V13 OK
- V17 25/25
- V18 17/17
- npm run build FINAL_EXIT:0
- Vite: 3110 módulos, built in 43.60s

Servidor local:
- /datos-auxiliares → HTTP 200
- /admin/migration-center → HTTP 200

FIN CORTE V18.


---
# 61. V19 · REGLA CANÓNICA DEL PÁRROCO ACTUAL

Definición del usuario:
LA ÚLTIMA FECHA DE INGRESO SIEMPRE DETERMINA EL PÁRROCO ACTUAL.

Aplicación:
- se ordenan los Párrocos de una parroquia por `fecha_ingreso DESC`;
- el primero queda `ACTIVO`;
- todos los anteriores quedan `HISTORICO`;
- la `fecha_salida` heredada del registro antiguo NO invalida al último ingreso como Párroco Actual;
- para efectos actuales y para fechas posteriores a su ingreso, el último registro se interpreta con vigencia abierta;
- los periodos de los Párrocos anteriores sí conservan fecha_ingreso/fecha_salida para resolución histórica.

Ejemplo operativo actual:
- 0001 · PBRO. ROBERTO PADILLA MARTÍNEZ · 2000-08-15 → 2005-12-20 · HISTORICO
- 0002 · PBRO. SANTIAGO MARTÍNEZ FUENTES · 2005-12-21 → 2012-01-29 · HISTORICO
- 0003 · PBRO. TEODORO GARCÍA GARCÍA · 2012-01-30 → 2021-01-10 · HISTORICO
- 0004 · PBRO. JAIDER HERRERA TURIZO · ingreso 2021-01-11 · ACTIVO / PÁRROCO ACTUAL

Aunque el legado trae fecha_salida=2025-06-15 para 0004, V19 conserva ese valor histórico como dato de origen, pero NO lo usa para quitarle la condición de Párroco Actual mientras no exista otro registro con una fecha_ingreso posterior.

Migración:
`supabase/applied-history/SACRAMENTUM_CURRENT_PRIEST_LATEST_INGRESS_V19.sql`

Funciones:
- `sacramentum_current_priest(uuid)`
- `sacramentum_recalculate_current_priest(uuid)`
- `sacramentum_priest_at_date(uuid,date)`

Nueva semántica de `sacramentum_priest_at_date`:
- para Párrocos anteriores, respeta periodo documentado;
- para el Párroco con mayor fecha_ingreso, ignora el cierre heredado y lo considera vigente desde su ingreso hacia adelante.

Frontend:
- `src/services/catalogsService.js`
  - `getParrocoActual` usa máxima fecha de ingreso;
  - `getParrocoEnFecha` trata al último ingreso como periodo abierto.
- `src/hooks/useSacramentalAuxiliaries.js`
  - `currentPriest` usa máxima fecha_ingreso;
  - `priestAtDate` conserva historia y abre sólo al último registro.

Impacto:
- Bautismo nuevo: Párroco que da fe = último ingreso.
- Matrimonio nuevo: Párroco que da fe = último ingreso.
- Exequias nuevas: Párroco que da fe = último ingreso.
- diálogos de impresión que usan `getParrocoActual`: último ingreso.
- Matrimonios/notificaciones actuales que consulten autoridad por fecha: último ingreso.
- registros históricos: autoridad según periodo de la fecha.

Postflight real:
- active_count = 1
- active_code = 0004
- active_name = PBRO. JAIDER HERRERA TURIZO
- priest_2003 = PBRO. ROBERTO PADILLA MARTÍNEZ
- priest_2010 = PBRO. SANTIAGO MARTÍNEZ FUENTES
- priest_2018 = PBRO. TEODORO GARCÍA GARCÍA
- priest_2024 = PBRO. JAIDER HERRERA TURIZO
- priest_2026 = PBRO. JAIDER HERRERA TURIZO

Gate:
`node scripts/verify-current-priest-v19.mjs`
Resultado:
`SACRAMENTUM V19 · OK · 12/12 controles.`

Regresión:
- V13 OK
- V18 17/17
- V19 12/12
- build FINAL_EXIT:0
- Vite 3110 módulos
- built in 39.69s

FIN CORTE V19.


---
# 62. V20 · SEPARACIÓN DE NOMBRES Y APELLIDOS EN PÁRROCOS IMPORTADOS

Incidencia:
al editar un Párroco importado desde PARROCOS.json, el campo Nombre contenía el nombre completo y Apellido estaba vacío.

Causa:
el JSON fuente sólo trae:
`nombre: "PBRO. TEODORO GARCÍA GARCÍA"`

La normalización anterior guardaba:
- nombre = nombre completo
- apellido = ""

Corrección V20:
`supabase/applied-history/SACRAMENTUM_LEGACY_PRIEST_NAME_SPLIT_V20.sql`

Se creó:
- `sacramentum_split_legacy_priest_name(text)`
- trigger `trg_normalize_legacy_priest_name`

Regla:
- conserva el nombre original completo en `payload.legacy_full_name`;
- conserva tratamiento en `payload.legacy_honorific`;
- conserva nombres en `payload.legacy_given_names`;
- conserva apellidos en `payload.legacy_surnames`;
- registra `name_split_confidence`.

Cuando la separación es inequívoca:
- Nombre conserva el tratamiento institucional + nombres;
- Apellido recibe los dos apellidos.

Resultados reales:
0001:
- Nombre: PBRO. ROBERTO
- Apellido: PADILLA MARTÍNEZ

0002:
- Nombre: PBRO. SANTIAGO
- Apellido: MARTÍNEZ FUENTES

0003:
- Nombre: PBRO. TEODORO
- Apellido: GARCÍA GARCÍA

0004:
- Nombre: PBRO. JAIDER
- Apellido: HERRERA TURIZO
- Estado: ACTIVO

El Párroco Actual sigue siendo 0004 por V19.

Frontend:
`src/config/legacyImportProfiles.js`
ahora genera:
- priest_name
- priest_given_names
- priest_surnames
- priest_honorific
- name_split_confidence

Seguridad:
si el nombre contiene partículas potencialmente ambiguas (DE, DEL, LA, LAS, LOS, Y, SAN, SANTA), no se corta agresivamente; queda `confidence=review`.

Smoke:
- PBRO. TEODORO GARCÍA GARCÍA -> TEODORO / GARCÍA GARCÍA
- PBRO. JUAN CARLOS PÉREZ GÓMEZ -> JUAN CARLOS / PÉREZ GÓMEZ
- PBRO. JUAN DE LA CRUZ -> review, sin división arbitraria

Gate:
`node scripts/verify-legacy-priest-name-split-v20.mjs`
Resultado:
`SACRAMENTUM V20 · OK · 14/14 controles.`

Regresión:
- V18 17/17
- V19 12/12
- V20 14/14
- build FINAL_EXIT:0
- Vite 3110 módulos
- built in 37.97s

FIN CORTE V20.


---
# 63. V21 · CORTE 25 DE SEPTIEMBRE DE 2026

- Se corrigió el motor V19 en `useSacramentalAuxiliaries.priestAtDate()`: el registro con fecha de ingreso más reciente queda abierto hacia adelante mientras no exista otro ingreso posterior.
- V19 volvió a pasar 12/12 controles.
- Se retiró por completo del sistema activo el módulo pastoral solicitado por el usuario, incluyendo frontend, servicios, perfiles legacy, parámetros, RPC, tablas vacías y metadatos residuales.
- La auditoría previa confirmó 0 registros reales, 0 pendientes, 0 lotes, 0 vínculos, 0 impresiones y 0 notas asociadas al módulo retirado.
- La migración V21 quedó aplicada en Supabase y su postflight dio todos los indicadores esperados.
- Build final: 3110 módulos, CSS 112.94 kB, JS 1,986.27 kB, exit code 0.
- Regresión final: Bautismo OK, Confirmación OK, Legacy OK, Exequias V7 OK, V15 OK, V16C 29/29, V17 25/25, V18 17/17, V19 12/12, V20 14/14.
- Checkpoint previo: `C:\SACRAMENTUM\CHECKPOINTS\SACRAMENTUM_FINAL_2026-09-25_PRE_V21`.
- No reintroducir el módulo retirado en V21.

FIN CORTE V21.


---
## NORMALIZACIÓN CLI / HISTORIAL SUPABASE · 2026-09-25

- CLI Supabase 2.118.0 autenticado con la cuenta correcta.
- Proyecto enlazado: REGISTRO SACRAMENTOS (`foczofcmwampjvlfbsqn`).
- Se corrigieron versiones de migraciones locales antiguas para que cada archivo tenga timestamp único de 14 dígitos.
- V21 local se alineó con la versión remota `20260925153625`.
- Se usó `supabase migration repair --status applied` únicamente para sincronizar metadata de las 25 migraciones históricas ya presentes en el esquema; no se reejecutó SQL de negocio.
- `supabase migration list`: Local y Remote coinciden en las 26 migraciones.
- `supabase db pull --linked` ya supera el problema de historial; actualmente se detiene sólo porque Docker Desktop/Podman no está instalado, requerido por el CLI para crear la base sombra local.
- El acceso remoto a Supabase queda operativo sin depender de Docker para consultas, migraciones y administración remota.


---
# 64. V22–V27 · SEGURIDAD, DEPENDENCIAS Y RENDIMIENTO · 25 DE SEPTIEMBRE DE 2026

Este bloque SUPERA el corte V21 como estado técnico actual.

## V22 · SECURITY HARDENING
- Se cerró por completo el rol `anon` sobre tablas del esquema `public`.
- `official_notifications` quedó con lectura RLS por ámbito institucional y mutaciones por RPC.
- Se retiraron grants directos innecesarios sobre objetos internos/legacy.
- Las funciones señaladas por el linter quedaron con `search_path` fijo.

## V23 · CIERRE DE EJECUCIÓN HEREDADA
- `anon` quedó con **0 funciones ejecutables**.
- `PUBLIC` quedó con **0 funciones ejecutables** en `public`.
- `authenticated` y `service_role` conservan únicamente grants explícitos.

## V24 · RLS & PERFORMANCE
- Se eliminaron políticas SELECT redundantes derivadas de políticas `ALL`.
- Se separaron permisos de escritura en INSERT / UPDATE / DELETE.
- Se optimizaron referencias `auth.uid()` para evitar evaluación repetida por fila.
- Se añadieron índices a claves foráneas de alto uso.

## V25 · PRIVILEGED RPC HARDENING
- Claves foráneas sin índice: **0**.
- Triggers ejecutables directamente por `authenticated`: **0**.
- Helpers `_internal` ejecutables directamente por `authenticated`: **0**.
- Funciones de mantenimiento/diagnóstico no usadas por frontend dejaron de ser RPC cliente.
- `sacramentum_recalculate_current_priest(uuid)` exige sesión y jurisdicción de parroquia.
- Auditoría automática de los RPC `SECURITY DEFINER` restantes: **0 sin guarda directa o delegada detectada**.
- Historial Supabase: **30 migraciones**, Local = Remote.

## V26 · DEPENDENCIAS
- Vite actualizado a **8.3.1**.
- `@vitejs/plugin-react` actualizado a **6.1.1**.
- React Router DOM actualizado a **7.18.4**.
- Correcciones de compatibilidad Vite: `import.meta.dirname` y extensión explícita `visual-editor-config.js`.
- `npm audit fix` normal, sin `--force`.
- Resultado final de `npm audit`: **0 vulnerabilidades**.
- Build después del saneamiento: **4.50 s**.

## V27 · CODE SPLITTING POR RUTAS
- `src/App.jsx` usa `React.lazy()` + `Suspense` para 56 páginas.
- El bundle inicial bajó de **1,963.61 kB** a **403.68 kB**.
- Gzip inicial bajó de **491.94 kB** a **126.39 kB**.
- Reducción aproximada: **79% bruto** y **74% gzip**.
- Desapareció el aviso de chunk inicial >500 kB.
- Bautismo, Confirmación, Matrimonio, Exequias, Cancillería, Diócesis, Centro de Migración y demás pantallas se descargan bajo demanda.
- Build V27: **3076 módulos**, **7.47 s**, exit code 0.

## REGRESIÓN FINAL V27
- Párroco actual V19: 12/12.
- Bautismo: OK.
- Confirmación: OK.
- Legacy relacional: OK.
- Exequias ↔ Bautismo V7: 14/14.
- V15: OK.
- V16C: 29/29.
- V17: 25/25.
- V18: 17/17.
- V20: 14/14.
- `npm audit`: 0 vulnerabilidades.

## ADVISOR SUPABASE
- La exposición de tablas a `authenticated` en GraphQL se mantiene donde la aplicación consulta tablas directamente y RLS gobierna filas.
- Los RPC `SECURITY DEFINER` funcionales conservados fueron revisados para guardas directas o delegadas.
- `Leaked Password Protection` permanece desactivado porque la organización Supabase está en plan **Free**; la documentación oficial la limita a **Pro o superior**.

## CHECKPOINTS
- `C:\SACRAMENTUM\CHECKPOINTS\SACRAMENTUM_FINAL_2026-09-25_PRE_V22_SECURITY`
- `C:\SACRAMENTUM\CHECKPOINTS\SACRAMENTUM_FINAL_2026-09-25_PRE_V26_DEPENDENCIES`
- `C:\SACRAMENTUM\CHECKPOINTS\SACRAMENTUM_FINAL_2026-09-25_PRE_V27_CODE_SPLITTING`

ESTADO CANÓNICO ACTUAL: **V27 ESTABLE**.
