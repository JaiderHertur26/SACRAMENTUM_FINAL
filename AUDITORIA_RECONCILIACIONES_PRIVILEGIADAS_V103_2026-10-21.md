# SACRAMENTUM V103 — Reconstrucciones históricas reservadas al mantenimiento técnico

**Fecha:** 21 de octubre de 2026. **Naturaleza:** reducción preventiva de exposición de funciones privilegiadas. **Estado:** privilegios revocados y comprobados; no se ejecutó operación sobre Bautismos o plantillas históricas reales.

## Dos funciones con efectos globales sensibles

1. `public.reconcile_maria_auxilio_baptisms_v65()`: función `SECURITY DEFINER`, propietario `postgres`, diseñada para una conciliación histórica concreta entre parroquias. Su cuerpo puede reasignar vínculos de importación, marcar Bautismos como revertidos y modificar el contexto de lotes históricos. Antes de V103 podía ser invocada por usuarios `authenticated` (aunque el propio cuerpo limitaba los roles `diocese` y `admin_general`).
2. `public.reconcile_legacy_document_template_provenance_v68()`: función `SECURITY DEFINER`, propietario `postgres`, que actualiza los metadatos de origen de todas las plantillas históricas que coincidan con los archivos fuente. Su validación de roles aceptaba `admin_general`, `diocese` y `chancery`, pero su UPDATE no estaba limitado a la diócesis del usuario.

La existencia de privilegios EXECUTE y su código fueron verificados antes de aplicar la migración. **No se ejecutaron estas operaciones en producción**, por lo que no se afirma haber producido daños ni probado un ataque de modificación contra registros reales.

La inspección de `src`, scripts de prueba y otras RPC no identificó un consumidor de estas dos funciones. Por su finalidad única de reparación histórica, no deberían exponerse como acciones habituales de usuarios institucionales.

## Remediación V103

Migración `supabase/migrations/20261021215313_reserve_historical_reconciliation_to_service_v103.sql`:

```sql
REVOKE EXECUTE ON FUNCTION public.reconcile_maria_auxilio_baptisms_v65()
 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_legacy_document_template_provenance_v68()
 FROM PUBLIC, anon, authenticated;
```

Se conservaron la propiedad `postgres`, el permiso de `service_role`, el cuerpo de las funciones y los datos reales. Ninguna reconciliación fue ejecutada por la migración.

**Comprobación SQL posterior por función:**

| Función | authenticated | anon | service_role | SECURITY DEFINER |
|---|---|---|---|---|
| Reconciliación Bautismos V65 | Sin EXECUTE | Sin EXECUTE | EXECUTE conservado | Sí |
| Procedencia documental V68 | Sin EXECUTE | Sin EXECUTE | EXECUTE conservado | Sí |

El inventario de funciones SECURITY DEFINER públicas ejecutables por `authenticated` bajó de **128 a 126**. No son 126 vulnerabilidades confirmadas: cada función requiere pruebas individuales de autoridad y ámbito.

## Regresión

Se creó `scripts/test-historical-maintenance-privileges-v103.mjs`, con **6 pruebas estáticas**: dos revocaciones explícitas, propietario/servicio conservados, ausencia de DML histórico, y ausencia de consumidores en web y scripts. Se añadió a la puerta de calidad y GitHub Actions.

La batería acumulada prevista es **300 pruebas sintéticas**, además de 23 verificadores históricos, build y comprobación de CSS.

## Continuación y límites

Mantener procedimientos internos sensibles fuera de la API general es defensa en profundidad, no una certificación de toda la integridad histórica. Siguen pendientes las pruebas detalladas de las 126 funciones privilegiadas accesibles a usuarios autenticados, verificación de la exactitud documental, respaldos restaurados, concurrencia y las cinco advertencias HIGH de dependencias.
