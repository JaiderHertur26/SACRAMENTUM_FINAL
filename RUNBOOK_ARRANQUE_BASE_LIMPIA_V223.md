# SACRAMENTUM FINAL — PROTOCOLO DE INICIO CON BASE LIMPIA (V223)

## Regla absoluta de esta etapa
**Todos los registros de SACRAMENTUM actualmente existentes son datos de prueba; ninguno es oficial.** No se borrará, transferirá ni declarará oficial ningún registro por el simple hecho de desplegar el sitio. Un cambio de variable de entorno nunca debe suprimir la señalización de prueba de la base QA.

### Hallazgos verificados: base actual QA
- Proyecto técnico de pruebas: `foczofcmwampjvlfbsqn` (identificador público, no es una contraseña).
- **82 tablas públicas** inventariadas, **59 con filas**, **95.320 filas públicas** en total, **12 usuarios en auth.users**, **0 archivos en storage.objects** y **1 contenedor de storage**.
- La cuenta de filas es exacta, consultada con SELECT desde la consola privilegiada el 27 de octubre de 2026 (hora UTC) y guardada sin nombres de personas ni credenciales en `AUDITORIA_BASE_PRUEBAS_SOLO_LECTURA_V223.json`.
- Dentro del conjunto hay 5.040 bautismos, 2.091 confirmaciones, 1.261 matrimonios y 16.331 filas de importación histórica. **Nunca tratar esas cantidades como oficiales**.
- No ejecutar TRUNCATE, DELETE, DROP, `supabase db reset --linked` ni eliminación de usuarios en este proyecto durante V223.

## Arquitectura adoptada: producción desde cero, sin trasladar QA
1. **Congelar ensayos** antes del corte de versión; respaldar por los mecanismos autorizados el entorno QA para reproducir errores, sin copiar datos hacia la instalación nueva.
2. **Crear un proyecto Supabase NUEVO E INDEPENDIENTE**, exclusivamente para producción, cuando hayan aprobado las pruebas finales. No usar clone/restore desde QA porque copiaría registros y cuentas ficticios.
3. Reproducir únicamente **esquema, índices, políticas RLS, funciones, permisos, configuración y catálogos básicos revisados** desde migraciones versionadas. Revisar las 156 migraciones de la rama aprobada y toda siembra de plantillas; ninguna importación legacy QA ni cuenta de ensayo puede ejecutarse contra producción. El proyecto nuevo también requiere configuración independiente de Auth, SMTP, Storage, Edge Functions y secrets.
4. **Ejecutar el inventario de solo lectura** `scripts/release-inventory-readonly-v223.sql` desde un usuario con lectura completa en el proyecto NUEVO. La lectura desde `anon` o un perfil parroquial NO es suficiente porque RLS puede ocultar filas. Examinar el resultado completo, no solo las tablas de sacramentos.
5. Exigir: **82/82 tablas conocidas presentes**, 0 tablas faltantes o inesperadas; **0 filas operativas/de usuarios**, **0 usuarios Auth** y **0 objetos de Storage**. Los catálogos de plantillas sembrados por migraciones son la única excepción posible, previa auditoría de origen, contenido y versión. Nunca copiar los catálogos manuales de QA a ciegas.
6. La función `scripts/release-inventory-evaluator-v223.mjs` evalúa censos completos de manera determinista, pero devuelve siempre `approvedForOfficialUse:false`: un conteo no reemplaza la inspección ni el visto bueno institucional. Crear un acta externa de inventario y autorización del administrador después del cotejo.
7. **Publicación oficial, solo después de autorización:** la compilación ahora usa `guard-official-build-v223.mjs`; rechaza `VITE_REGISTRY_DATA_MODE=official` en QA, o sin acta V223 fresca, completa y correspondiente a otro proyecto independiente. Para el acta requiere variable privada de build `SACRAMENTUM_RELEASE_ATTESTATION_PATH` que señale el JSON validado localmente por el responsable. Esta puerta previene accidentes de configuración; no es firma criptográfica ni reemplaza las políticas RLS del backend.
8. Publicar la versión aprobada con la URL y clave **publicable** del nuevo proyecto, verificar nuevo host, autenticación, RLS, separación de jurisdicciones, los cuatro sacramentos, Cancillería, decretos, comunicación, notas, reportes, impresión y mensajes. Nunca poner service_role en el frontend.
9. **Solo entonces** crear de manera autorizada el primer Administrador General, su jerarquía institucional, cuentas diocesanas y parroquiales. Los numeradores/libros iniciales deben comenzar según las reglas parroquiales aprobadas, no reutilizar consecutivos de QA.
10. Las primeras partidas auténticas se registrarán **únicamente en el proyecto nuevo**, después del acta de puesta en marcha. Desde la primera partida real, quedan prohibidas las limpiezas experimentales y se activa el régimen de respaldo y recuperación.

## Criterios de bloqueo y recuperación
- Si una tabla nueva no aparece en el manifiesto (o falta alguna), el inicio oficial se bloquea.
- Si hay alguna cuenta/registro/nota/decreto/pendiente/mensaje/auditoría legacy de QA en el proyecto nuevo, el inicio oficial se bloquea.
- Si no se verificaron las identidades, se detectaron permisos inseguros, las dependencias presentan vulnerabilidades o falló un E2E real, no se autoriza el cambio.
- En un fallo anterior al primer registro real, revisar y reconstruir el proyecto limpio. Después del primer registro real: recuperación por respaldo, **nunca reset ni migración de datos de prueba desde QA**.
- El indicador `VITE_REGISTRY_DATA_MODE` es **presentacional** y no convierte ni acredita registros; la autorización jurídica y el aislamiento del servidor siempre se verifican por separado.

## Estado V223
Se implementaron inventario SQL de 82 tablas, evaluación de inventarios, precinto de documentos de QA y guard de compilación. **No se realizó ningún borrado en QA, ni se creó aún una base oficial, ni se transfirió un solo registro a producción.** El arranque limpio queda preparado técnicamente, pero requiere la certificación final y la puesta en marcha institucional.

## Adenda obligatoria V224 — seguridad antes de cualquier estreno oficial
**Esta adenda tiene precedencia frente a la posibilidad de publicar basándose solo en el inventario V223.** La puerta `official` exige acta **V224** y ejecución de `scripts/release-security-preflight-v224.sql` con acceso privilegiado de solo lectura en el proyecto nuevo. Debe registrar 0 tablas con RLS apagado; 0 privilegios peligrosos TRUNCATE para anon/authenticated; 0 claves foráneas no validadas; 0 grants predeterminados peligrosos de tablas; 0 grants predeterminados abiertos de EXECUTE; 0 funciones SECURITY DEFINER ejecutables por anon; 0 funciones privilegiadas sin search_path explícito; y revisión institucional de todas las funciones SECURITY DEFINER expuestas a authenticated.

**Actualmente QA NO cumple la puerta V224** porque se detectaron 8 entradas de privilegios predeterminados peligrosos y 3 aperturas por defecto de ejecución. Debe remediarlas quien sea dueño autorizado del rol que crea los objetos, después de analizar todas las consecuencias. La conexión `postgres` auditada no administra los defaults de `supabase_admin`: no debe inventarse una migración no ejecutable ni hacer cambios indiscriminados a las 152 funciones.

La configuración de `auth_leaked_password_protection` y avisos GraphQL también debe revisarse desde el panel Supabase con criterios de necesidad, no aplicando revocaciones globales que rompan flujos. Aun después del preflight, los conteos y el acta son controles preventivos y **no constituyen por sí solos garantía legal ni certificación formal de la seguridad**.

Hasta completar estos requisitos, los datos QA permanecen intactos, marcados NO OFICIALES y destinados únicamente a pruebas.

## Adenda V226 — mantener el entorno de pruebas separado del futuro registro oficial
Se endurecieron efectivamente las concesiones predeterminadas de objetos `public` creados por `postgres` en QA, sin cambiar datos. Los procedimientos y evidencias constan en `RUNBOOK_SEGURIDAD_PERMISOS_V226.md`, `supabase/security/` y `AUDITORIA_PRIVILEGIOS_PREDETERMINADOS_LIVE_V226.json`. El guard de compilación en modo oficial ahora exige acta **V226** y censo de permisos futuros con protección **global** de `PUBLIC EXECUTE`. Ninguna acta V223/V224 basta. **supabase_admin sigue pendiente** de una intervención administrativa autorizada; no se debe intentar una limpieza o migración de datos QA hacia el futuro sistema oficial.

## Adenda V229 — Endurecimiento de SECURITY DEFINER
El modo registral `official` exige ahora el protocolo **V229**, incluida medición `insecure_public_only_definers=0` con `scripts/release-security-preflight-v229.sql`, además de RLS/ACL limpias y revisión formal de RPC. La migración `20261027044045_secure_definer_pg_temp_last_v229.sql` ya se ejecutó **solo en QA** y cambió `search_path` de 131 funciones sin copiar ni borrar partidas. La nueva base de uso oficial deberá reconstruirse desde migraciones auditadas, proteger también `supabase_admin`, restaurar un respaldo de ensayo y permanecer absolutamente separada de los datos ficticios. Véase `RUNBOOK_ENDURECIMIENTO_RPC_V229.md`.

## Adenda V230 — GraphQL deshabilitado y controlado
SACRAMENTUM no consume la API GraphQL en su código React. La migración `20261027115104_disable_unused_pg_graphql_v230.sql` fue aplicada en QA para desactivar `pg_graphql` sin alterar registros ni Auth; eliminó 64 advertencias de exposición de esquema GraphQL en Supabase Advisors. Toda instalación futura que pretenda modo oficial debe presentar acta de protocolo **V230** y comprobar mediante `scripts/release-security-preflight-v230.sql` el indicador `unused_pg_graphql_enabled=0`, además de sus restantes requisitos de seguridad. No confundir la corrección de GraphQL con la pendiente revisión de las 152 funciones REST privilegiadas ni con la autorización de datos reales.

## Adenda V231 — El origen histórico no se puede convertir en datos oficiales
La inspección estática de 158 migraciones históricas identificó 45 sentencias directas de modificación de datos: seis candidatas de catálogos/plantillas y **39 mutaciones que no deben reproducirse indiscriminadamente** al crear un sistema oficial vacío. QA tiene cuatro conceptos cargados del antiguo catálogo DBF con UUID de una diócesis particular. La puerta V231 exige un acta de reconstrucción estructural independiente, certificados de las 158 fuentes anclados por huella SHA256, catálogos revisados, cero usuarios y filas ficticias, y las lecturas `qa_legacy_dbf_concept_rows=0` y `qa_legacy_template_snapshot_rows=0`. Esta nueva exigencia se suma a RLS, ACL, RPC, SMTP, backups, actas y proyecto nuevo. Véase `RUNBOOK_LANZAMIENTO_SIN_DATOS_QA_V231.md`.

## Adenda V232 — autenticación explícita y migración 159
El catálogo actualmente tiene **159 migraciones**, incluida la nueva `20261027125848_harden_chat_actor_guard_v232.sql` aplicada en QA para las tres funciones de escritura del chat. No agregó operaciones DML directas de instalación: continúan las **14 migraciones históricas con 45 modificaciones de datos**, de las cuales 39 requieren tratamiento y seis inserciones de catálogos requieren aprobación. La huella global vigente está en `AUDITORIA_MIGRACIONES_DATOS_V232.json` y en `release-migration-provenance-v231.mjs`. Las comprobaciones de sesiones reales, tres rechazos entre diócesis y ausencia de nuevas filas QA se documentan en `AUDITORIA_CIERRE_TECNICO_V232_2026-10-27.md`. La auditoría automática NO equivale a certificación formal de las 152 funciones privilegiadas.
