# SACRAMENTUM FINAL · Auditoría privilegiada V92

**Fecha:** 21 de octubre de 2026. **Ámbito:** integridad de secuencias documentales y permisos RPC. **Estado:** corrección aplicada y verificada; la auditoría integral permanece abierta.

## 1. Hallazgo reproducido: asignación irregular de consecutivos oficiales

**Identificador:** V92-SEC-001. **Severidad de ingeniería:** ALTA por integridad jurídica documental (no es evidencia de acceso a información personal).

La función `public.next_document_sequence(uuid,text,text)` tenía `GRANT EXECUTE` para `authenticated`. Su implementación permitía a un usuario Parroquia pedir un consecutivo para el ámbito `diocese_id` de su perfil, con cualquier `document_type`, aunque no estuviera emitiendo ni auditando un documento.

Se simuló una sesión autenticada con rol `parish` dentro de **BEGIN / ROLLBACK**. Mediante una llamada directa al asignador, con ámbito diocesano y tipo de documento ficticio `document:QA-V92-DENIAL-PROOF`, se obtuvo **QA-000001**. Ese resultado confirma que la función podía consumir números sin pasar por una operación oficial de emisión.

No se usó una identidad ficticia persistente y la transacción no conservó ningún incremento.

## 2. Corrección desplegada en Supabase

Migración **`block_direct_document_sequence_v92`**, archivo local:

`supabase/migrations/20261021174920_block_direct_document_sequence_v92.sql`

Código esencial:

```sql
REVOKE EXECUTE ON FUNCTION public.next_document_sequence(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
```

La función sigue siendo interna de las rutas autorizadas y conservó acceso para su propietario PostgreSQL y `service_role`. Se revisaron las tres RPC que la llaman: `issue_document_from_template`, `generate_diocesan_sacramental_report` e `issue_confirmation_notification_v43`. Son funciones `SECURITY DEFINER`, propiedad de `postgres`, por lo que la revocación no impide sus llamadas internas.

La interfaz React tenía `src/services/documentSequenceService.js`, un adaptador antiguo que llamaba directamente al RPC y no tenía consumidores. Se eliminó para prevenir regresiones o usos futuros indebidos.

## 3. Prueba adversarial posterior al parche

| Comprobación | Resultado |
| --- | --- |
| `authenticated` puede ejecutar asignador directamente | **NO** |
| `anon` puede ejecutarlo | **NO** |
| `service_role` mantiene privilegio | **SÍ** |
| Intento directo desde una sesión Parroquia | **DENEGADO, SQLSTATE 42501** |
| Procedimiento oficial `issue_document_from_template` como Parroquia | **FUNCIONA** |
| Número del documento ficticio emitido por el procedimiento legítimo | `D73061-000001` |
| Documento temporal creado en el mismo flujo | **1** |
| Entrada de auditoría `document_issued` del mismo flujo | **1** |
| Documento ficticio almacenado tras `ROLLBACK` | **0** |
| Secuencias ficticias del ataque almacenadas | **0** |

La prueba positiva usó una plantilla del sistema vigente y variables con valores explícitamente ficticios. Tanto la emisión como su entrada de auditoría se examinaron antes de revertir la transacción.

## 4. Regresión permanente

Nuevo archivo: `scripts/test-privileged-sequences-v92.mjs`, con **5 pruebas** de permisos declarados, ausencia de acceso directo en React, no existencia del adaptador antiguo, ausencia de modificación de números en la migración y preservación de permisos internos.

El script se incorpora a la batería `scripts/audit-gate-v90.mjs` y a GitHub Actions. Las pruebas estáticas NO reemplazan el ensayo conductual SQL previamente ejecutado.

## 5. Estado de los avisos de Supabase

Tras aplicar la migración, `get_advisors(type=security)` informó:

- **128** funciones SECURITY DEFINER ejecutables por authenticated, antes **129**. Estos 128 registros son **avisos por superficie privilegiada, no 128 vulnerabilidades confirmadas**.
- **60** objetos que aparecen en el esquema GraphQL para authenticated. La disponibilidad de esquema no demuestra por sí sola lectura de información restringida; revisar RLS por entidad.
- **1** advertencia de protección de contraseñas filtradas (configuración Auth), no modificada en esta operación.

Referencias de remediación del asesor:
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## 6. Limitaciones y continuación

Esta auditoría corrige **una falla comprobada y reproducida**. No demuestra la seguridad de las 128 funciones privilegiadas restantes ni certifica de forma integral la aplicación. Siguen pendientes los ensayos cruzados de funciones por rol, ámbito parroquial, concurrencia, impresión, restauración y las cinco alertas HIGH del gestor de dependencias.

**Regla:** conservar tests en el repositorio, ejecutar 211 pruebas unitarias/sintéticas previstas, 23 verificadores y compilación; desplegar únicamente después de comprobar que los cambios de frontend son compatibles.
