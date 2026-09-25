# SACRAMENTUM · Despliegue profesional Fase 2

## Principio
Esta fase es **aditiva y conservadora**: no elimina ni renombra tablas históricas y no borra partidas. `dioceses → vicarias → decanatos → parishes` es la ruta territorial canónica de la aplicación. `vicariates/deaneries` se mantienen como legado hasta conciliar datos. `diocesis` se conserva como catálogo auxiliar porque su estructura y uso no equivalen a `dioceses`.

Supabase/PostgreSQL es la **fuente jurídica y operativa oficial**. IndexedDB/localStorage sólo pueden actuar como caché o preferencias de interfaz; nunca deciden por sí solos el estado de una partida, decreto, nota marginal o consecutivo.

## Antes de aplicar
1. Crear backup completo de PostgreSQL/Supabase y verificar que pueda restaurarse.
2. Probar primero en un proyecto Supabase de staging con copia representativa.
3. Ejecutar `preflight/20260904_phase2_preflight.sql` y resolver cualquier duplicado Libro/Folio/Número o perfil sin jurisdicción.
4. Verificar que `auth.users` y `user_profiles.auth_user_id` estén correctamente vinculados.
5. No desplegar el frontend Fase 2 antes de completar todas las migraciones y el postflight.

## Orden exacto
1. `security/001_security_helpers_review.sql`
2. `migrations/20260904_001_registry_core.sql`
3. `migrations/20260904_003_atomic_registry_workflows.sql`
4. `migrations/20260904_004_baptism_atomic_and_reversal.sql`
5. `migrations/20260904_005_matrimonial_manual_resolution.sql`
6. `migrations/20260904_006_baptism_replacement_atomic.sql`
7. `migrations/20260904_007_atomic_baptism_confirmation_seating.sql`
8. `migrations/20260904_008_replacement_reversal.sql`
9. `migrations/20260904_009_historical_registry_imports.sql`
10. `security/002_rls_core_review.sql`
11. `migrations/20260904_002_registry_rls.sql`
12. `migrations/20260904_010_governance_and_concepts.sql`
13. `migrations/20260904_011_notification_and_audit_lockdown.sql`
14. `migrations/20260904_012_confirmation_replacement_and_marriage_nullity.sql`
15. `migrations/20260904_013_historical_funeral_registry.sql`
16. `migrations/20260904_014_marginal_note_templates.sql`
17. `migrations/20260904_015_integrity_constraints.sql`
18. `migrations/20260904_016_identity_governance.sql`
19. Desplegar y probar `functions/activate-environment` con `SUPABASE_SERVICE_ROLE_KEY` sólo en el servidor.
20. Ejecutar `preflight/20260904_phase2_postflight.sql`.

> `20260904_002_registry_rls.sql` se aplica después de crear las tablas base y los helpers. `011` vuelve a endurecer operaciones sensibles; `012–015` completan los flujos jurídicos/configuración e integridad; `016` blinda perfiles y códigos de activación sin destruir identidades.

## Pruebas obligatorias por rol
### Parroquia
- Crear expediente y asentar Bautismo individual y por lote.
- Crear expediente y asentar Confirmación individual y por lote; comprobar nota marginal cruzada al Bautismo.
- Crear/asentar Matrimonio; comprobar Partidas e Índice desde Supabase.
- Emitir una Notificación Matrimonial; procesarla desde una segunda parroquia.
- Registrar y asentar Exequias.
- Digitalizar un Bautismo, Confirmación, Matrimonio y Exequias históricos y comprobar que **no cambia** el consecutivo ordinario vivo.
- Consultar decretos recibidos sin poder emitir/modificar correcciones, reposiciones o nulidades directamente.
- Consultar una nulidad matrimonial recibida y comprobar la nota marginal correspondiente.
- Guardar/cargar plantillas de notas marginales desde `parish_parameters.marginal_notes_templates`.

### Cancillería
- Buscar Bautismo de una parroquia de su diócesis y emitir corrección.
- Buscar Confirmación y emitir corrección; comprobar original anulada + supletoria + notas + aviso.
- Emitir decreto de Exequias.
- Registrar reposición de Bautismo para una parroquia destino.
- Registrar reposición de Confirmación y comprobar partida supletoria, nota, aviso y auditoría.
- Revertir una corrección/reposición y verificar que no se elimina ni reutiliza la partida/consecutivo.
- Registrar una sentencia/decreto de nulidad matrimonial; comprobar estado `nullified`, nota en Matrimonio y notas de Bautismo enlazadas cuando se seleccionen.
- Consultar el archivo de nulidades emitidas de la diócesis.

### Diócesis/Admin General
- Confirmar alcance territorial, lectura y administración esperados.
- Verificar que ninguna cuenta pueda leer/escribir otra jurisdicción fuera de sus permisos.
- Verificar que los conceptos de anulación se desactivan, no se borran físicamente.

## Regla de numeración
Los consecutivos oficiales se reservan dentro de funciones PostgreSQL con bloqueo de `parish_parameters`. Si dos equipos intentan usar el mismo número, uno debe fallar con mensaje de recarga; nunca se acepta un duplicado silencioso.

La digitalización histórica es distinta del asiento ordinario: conserva Libro/Folio/Número del libro físico y **no avanza** el consecutivo vivo.

## Regla documental
- Los decretos/sentencias emitidos son expedientes históricos e inmutables.
- Las partidas asentadas no se editan ni eliminan directamente desde el navegador.
- Una reversión no borra partidas ni retrocede consecutivos: marca estados y conserva auditoría.
- Las notas marginales conservan `source_type/source_id/decree_id`.
- Las plantillas de notas viven en `parish_parameters.marginal_notes_templates`.

## Notificación matrimonial
- Digital: enlaza directamente la partida bautismal destino.
- Manual: conserva Libro/Folio/Número y, al procesar, intenta resolver automáticamente una partida digital de la parroquia receptora. Si no existe, registra la certificación de asiento físico sin perder el expediente.
- Procesar/cancelar/archivar usa RPC auditadas; no se borra el historial documental.


## Gobierno de identidades
- `pending_tokens` nunca se consulta desde una sesión pública; sólo Admin General o la Diócesis creadora los administran.
- La activación se consume server-side con `activate-environment`.
- La reasignación de perfiles subordinados usa `update_managed_user_profile`; el navegador no recibe permiso UPDATE general sobre `user_profiles`.
- Revocar acceso usa `set_managed_user_active`: el perfil se conserva y queda auditado, no se elimina.

## Producción
No despliegue el frontend actualizado hasta aplicar **001–016 en el orden anterior, las dos capas de seguridad/RLS, desplegar la Edge Function de activación y completar el postflight**. Las pantallas nuevas llaman RPCs y columnas que no existen en el esquema antiguo.

## Conciliación antes de la restricción 015
Si el preflight muestra duplicados, **no elimine filas para “hacer pasar” la migración**. Identifique primero cuál registro es canónico y conserve evidencia del ajuste. Para decretos, después de aplicar 001 y antes de 015 puede revisar:

```sql
select diocese_id, lower(trim(decree_number)) as decree_number, count(*)
from public.decretos
where diocese_id is not null and nullif(trim(decree_number),'') is not null
group by diocese_id, lower(trim(decree_number))
having count(*) > 1;
```

`015_integrity_constraints.sql` omite de forma segura el índice concreto si aún existen conflictos y emite un `NOTICE`; el postflight permite comprobar qué restricciones quedaron realmente activas.
