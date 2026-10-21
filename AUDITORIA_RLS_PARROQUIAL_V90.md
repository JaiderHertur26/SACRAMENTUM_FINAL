# SACRAMENTUM · Prueba RLS de aislamiento parroquial V90

Fecha: 2026-10-21. Ejecutada en Supabase con sesión SQL temporal autenticada como un usuario Parroquia activo, sin registrar ni divulgar sus credenciales ni su identidad. Transacción terminada con ROLLBACK.

## Resultado de las lecturas fuera de parroquia propia

| Entidad restringida | Registros ajenos visibles |
| --- | ---: |
| Bautismos | 0 |
| Confirmaciones | 0 |
| Matrimonios | 0 |
| Exequias | 0 |
| Decretos | 0 |
| Notas marginales | 0 |
| Boletas pendientes de Bautismo | 0 |
| Boletas pendientes de Confirmación | 0 |
| Boletas pendientes de Matrimonio | 0 |
| Boletas pendientes de Exequias | 0 |

La verificación comparó cada `parish_id` visible con `public.current_app_parish_id()` usando el rol real de PostgreSQL `authenticated` y `auth.uid()` del perfil parroquial. No se hicieron escrituras.

El conjunto real contiene datos distribuidos entre varias parroquias: 5.040 Bautismos en tres parroquias, 2.091 Confirmaciones en dos, 1.261 Matrimonios en dos y 82 notas marginales en dos. Es por tanto una prueba con datos potencialmente ajenos, no sólo con tablas vacías.

**Alcance:** estas diez políticas de consulta RLS superaron el ensayo negativo de una identidad parroquial. No implica que todos los roles, tablas, operaciones de escritura o RPC estén aprobados. Faltan otras cuentas parroquiales y comparación entre diócesis.

## Método de repetición

BEGIN; simular sujeto mediante set_config('request.jwt.claim.sub', perfil parroquial autorizado, true); SET LOCAL ROLE authenticated; medir conteos para WHERE parish_id <> public.current_app_parish_id(); ROLLBACK.

No almacenar tokens, contraseñas ni identificadores personales en informes.
