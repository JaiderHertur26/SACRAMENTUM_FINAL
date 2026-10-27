# SACRAMENTUM FINAL — cierre técnico V243 (27 de octubre de 2026)

**Ambiente:** Supabase QA `foczofcmwampjvlfbsqn`, cuentas y datos ficticios. **No apto para uso sacramental oficial.**

## Corrección implementada y aplicada en QA
La rutina privilegiada `public.materialize_legacy_decrees_v68(uuid,integer)`, encargada de transformar registros históricos ANULACION en decretos, utilizaba un lookup de `chancery_id` que aceptaba `coalesce(up.is_active,true)=true` y no verificaba expresamente el estado ACTIVE ni que la Cancillería perteneciera a la diócesis. La selección previa de `current_app_role()` ya era restrictiva, por lo que **el patrón no prueba por sí solo un bypass explotable**, pero mantener un segundo acceso permisivo era una debilidad evitable de defensa en profundidad.

Se aplicó mediante Supabase `apply_migration` la migración versión V243 `20261027133000_harden_materialize_chancery_v243.sql`. El control exige ahora `is_active IS TRUE`, `status='ACTIVE'`, rol Cancillería, `up.diocese_id = v_user_diocese`, existencia de `chancelleries.id=up.chancery_id` con idéntica diócesis, y deniega un `chancery_id` nulo. Se volvió null-safe la comparación inicial del rol. La migración es solo DDL y rechaza cambios imprevistos en las dos cláusulas SQL originales antes de aplicar una sustitución.

## Validación directa y regresiones
La inspección real de `pg_proc` comprobó los cuatro nuevos controles y la ausencia del `coalesce(up.is_active,true)` original. Se ejecutaron cuatro ensayos SQL con `SET LOCAL ROLE authenticated` usando identidades QA: `parish`, `diocese` y `admin_general` fueron denegados; `chancery` llegó a exigir explícitamente un origen histórico. Todos usaron un argumento nulo y `BEGIN READ ONLY ... ROLLBACK`; ninguna operación válida de materialización ni modificación de partidas tuvo lugar.

El hash canónico de los 152 RPC `SECURITY DEFINER` expuestos a autenticados cambió de `f5f6d63ed04cb647d96f7175a054f39a` a `f1efe81bc94e1163ce611d54ba8575fb`; se congeló el hash observado en la puerta de publicación y se preservaron todas las huellas anteriores como evidencia fechada. El manifiesto de migraciones pasa a **163 archivos**, de los cuales **14 contienen las 45 sentencias DML históricas clasificadas**. Ninguna sentencia de registros QA ha sido reautorizada para el replay en producción.

Recuento de control QA posterior: **5.040** Bautismos, **2.091** Confirmaciones, **1.261** Matrimonios, **1** Exequia y **12** cuentas; todos intactos. La puerta de pruebas incorpora `scripts/test-harden-historical-chancery-v243.mjs` y la verificación CI GitHub.

## Riesgos y criterio de lanzamiento
Desde V240 se han reforzado **10 funciones** de identidad o acceso privilegiado. Las 152 funciones públicas del catálogo no se consideran automáticamente aprobadas: falta inspección semántica de cada cadena de escritura, prueba de incidentes/restauración, base independiente creada sin datos ficticios, validación de correo SMTP y aceptación institucional de impresos, sellos y firmas.

Cinco tablas internas con RLS habilitado y cero políticas siguen deliberadamente **cerradas al cliente**, según asesor de Supabase. Los 152 avisos del asesor sobre funciones SECURITY DEFINER son un inventario de exposición, no demostración automática de fallos; su revisión individual permanece como puerta de lanzamiento.

**Avance técnico ponderado informado previamente: 97,41 % (estimado).** No se declara 100 % ni se habilita modo oficial sin las pruebas mencionadas y la aprobación institucional.
