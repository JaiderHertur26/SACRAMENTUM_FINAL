# SACRAMENTUM FINAL V240 — Corrección real de reversión de decretos con Cancillería suspendida

**27 de octubre de 2026.** Proyecto de ensayo Supabase: `foczofcmwampjvlfbsqn`. **Todas las cuentas y partidas son ficticias.**

## Hallazgo de seguridad
Las funciones `public.reverse_marriage_decree(uuid,text)` y `public.reverse_funeral_decree(uuid,text)` contenían una autorización débil del usuario de Cancillería:

```sql
coalesce(up.is_active,true)=true
AND coalesce(up.status,'active') NOT IN ('blocked','disabled','inactive')
```

Esta lógica aceptaba potencialmente un `is_active` nulo e ignoraba estados de suspensión, especialmente `SUSPENDED`, al excluir solo tres cadenas exactas sensibles a mayúsculas. Usaba además `v_role <> 'chancery'`, que no rechaza de forma inequívoca un rol nulo en PL/pgSQL.

## Corrección aplicada efectivamente
Migración `supabase/migrations/20261027110500_harden_reversal_active_chancery_v240.sql` aplicada en QA bajo el nombre `harden_reversal_active_chancery_v240`. Las dos definiciones ahora exigen:

- `up.is_active IS TRUE`
- `upper(coalesce(up.status,''))='ACTIVE'`
- vínculo `chancelleries.id=user_profiles.chancery_id` y coincidencia de `diocese_id`
- `v_role IS DISTINCT FROM 'chancery'` para denegar roles nulos.

La migración es exclusivamente DDL: no crea ni modifica partidas, relaciones entre sacramentos ni registros de usuarios. Exige una sola coincidencia de cada cláusula original; si algo no coincide, falla la transacción. Conserva firma, propietario, comportamiento posterior, `SECURITY DEFINER`, búsqueda de decreto, controles de jurisdicción, historial de auditoría y permisos EXECUTE existentes.

## Pruebas reales
La lectura de `pg_proc` tras migrar verificó en ambas funciones que los cuatro controles están presentes y que no permanece la antigua excepción `coalesce(is_active,true)`. Ambas cuentas ficticias de Cancillería activas mantienen vínculo válido con su registro de Cancillería.

Se ejecutaron **ocho comprobaciones SQL de rol**: seis accesos desde cuentas de prueba ajenas a Cancillería fueron rechazados por `Rol no autorizado`; las dos llamadas desde Cancillería activa con un ID inexistente fueron rechazadas por `Decreto no encontrado`. Para estas últimas se usó `BEGIN ... ROLLBACK` porque las funciones utilizan `SELECT FOR UPDATE`; las primeras se pudieron comprobar bajo `READ ONLY`. Ningún decreto fue revertido.

La huella del catálogo de las **152 funciones privilegiadas** cambió de `4ded9ebe1d9cde435befee3f8b131222` a `d68b18810533c368d26f2c43e2ea9711`. Se actualizó la huella esperada en la puerta de seguridad y los tests sintéticos, conservando el acta histórica V236 sin alterarla. El recuento de 152 funciones no cambió.

## Certificación pendiente
Los ensayos de rechazo no equivalen a pruebas de escritura de decretos válidos ni a revisión semántica completa de todas las funciones, y no certifican la instalación independiente, respaldo restaurado, SMTP ni impresos institucionales. **Avance ponderado 97,41 %; autorización para uso oficial: NO.** La evidencia de QA está en `AUDITORIA_REVERSOS_CANCILLERIA_V240.json`.

## Nueva observación tras la corrección V240
Un barrido posterior, solo de metadatos `pg_proc` entre las funciones `SECURITY DEFINER` ejecutables por `authenticated`, detectó **otras 15 funciones** con al menos un patrón de actividad permisiva (`coalesce(...is_active,true)` o exclusión textual de tres estados), incluyendo rutas de creación de documentos, chat, consulta matrimonial, asientos, importación y parámetros parroquiales. Es un inventario de **candidatas a auditoría**, NO una conclusión automática de explotación: puede haber otras defensas, permisos de rol o validaciones posteriores. Estas 15 requieren inspección semántica firma por firma, priorizando escrituras e información sensible. La V240 resuelve dos funciones demostradas, pero no autoriza afirmar que todas las 152 RPC estén corregidas. Los hallazgos no se eliminan de la puerta oficial pendiente.
