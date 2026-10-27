# SACRAMENTUM FINAL — Cierre de seguridad V244 (27 de octubre de 2026)

**Ambiente:** Supabase QA `foczofcmwampjvlfbsqn`. Todos los lotes, partidas y usuarios son ficticios; no corresponde todavía a operación sacramental oficial.

## Falla reproducida antes de corregir
Las funciones públicas privilegiadas `apply_legacy_import_batch_v2(uuid,integer)` y `apply_legacy_import_batch_v3(uuid,integer)` leían el tipo del lote antes de confirmar `can_manage_legacy_import`. En un ensayo SQL real, una cuenta parroquial de **otra diócesis** que consultó un lote real `ANULACION` recibió una excepción específica que revelaba su existencia y naturaleza. Al consultar un lote inexistente, recibía una excepción diferente. La comprobación `can_manage_legacy_import` de la versión v2 ocurría demasiado tarde. Se trataba de una fuga de información entre jurisdicciones, no de prueba de alteración de partidas.

## Corrección real aplicada en QA
Migración versionada: `supabase/migrations/20261027143000_authorize_legacy_batch_before_profile_v244.sql`, aplicada con `Supabase apply_migration`. Ambas funciones ahora **restringen la consulta inicial del lote por `can_manage_legacy_import(parish_id,diocese_id)`**, antes de interpretar el tipo y, en la v2, antes de adquirir `FOR UPDATE`. El cambio está limitado a la consulta de lote; firmas, permisos posteriores, bloqueo `ANULACION` y semántica de importaciones autorizadas se conservan. La migración compara exactamente el SQL esperado y aborta si hubo cambios no auditados.

## Pruebas antes y después

| RPC | Ensayo en QA | Después |
|---|---|---|
| v2 | Parroquia extranjera, lote real `ANULACION` | `Lote no encontrado` |
| v2 | Misma cuenta, UUID inexistente | `Lote no encontrado` |
| v2 | Cuenta competente, lote `ANULACION` | Se conserva la denegación especial |
| v3 | Parroquia extranjera, lote real `ANULACION` | `Lote no encontrado` |
| v3 | Misma cuenta, UUID inexistente | `Lote no encontrado` |
| v3 | Cuenta competente, lote `ANULACION` | Se conserva la denegación especial |

**6 de 6 resultados esperados**, usando el rol SQL `authenticated` e identidades QA con `request.jwt.claim.sub` temporal, transacciones con `ROLLBACK`, sin ningún flujo de importación válido ni escrituras exitosas. La evidencia de rechazo previo y posterior está en `AUDITORIA_ACL_IMPORTACIONES_LIVE_V244.json`, sin exponer identificadores de personas ni de lotes.

Los recuentos de control siguieron iguales: **5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia y 12 cuentas QA**.

El catálogo de funciones privilegiadas accesibles por `authenticated` continúa con **152 funciones**; su huella verificada en PostgreSQL cambió de `f1efe81bc94e1163ce611d54ba8575fb` (V243) a `d10ec9b11e3726fc8427dd983400028e` (V244). La puerta de publicación ahora exige la nueva huella. El manifiesto incluye **164 migraciones** y conserva identificados **14 archivos** con **45 sentencias históricas DML**, sin reautorizar su ejecución sobre un futuro entorno limpio.

## Límites antes de uso oficial
Se cerró una fuga de información confirmada en estas dos funciones, pero **no se ha certificado la semántica integral de las 152 RPC**, ni se ha probado una restauración física de respaldo, una nueva base oficial independiente sin registros QA, correo SMTP/reestablecimiento ni la aceptación de partidas impresas por la autoridad eclesiástica. Las pruebas CI posteriores validan evidencia fechada y archivos de código; **no vuelven a ejecutar las pruebas vivas automáticamente**.

**Estimación técnica mantenida: 97,41 %.** La publicación de código no habilita registros sacramentales oficiales.
