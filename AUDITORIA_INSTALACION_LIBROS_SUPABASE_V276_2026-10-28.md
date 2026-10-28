# SACRAMENTUM FINAL — Instalación preparatoria del sistema de libros en Supabase (V276)

Fecha: 28 de octubre de 2026.
Proyecto Supabase: REGISTRO SACRAMENTOS (foczofcmwampjvlfbsqn).
Estado: **14 migraciones registradas y ejecutadas**, esquema privado y RPC sin permisos de uso para clientes. **No equivale a puesta en marcha oficial.**

## Qué se instaló
- V252: memorias de libros alfanuméricos, folios, ordinales, asientos activos, auditoría inmutable, disparadores y RLS.
- V253: operaciones y dependencias de asientos; se excluyeron funciones QA que no corresponden a datos reales.
- V263: cuatro procedimientos nuevos de asiento real y tabla de atestaciones.
- V264 y V265: consulta de contexto y certificación de celebraciones nuevas.
- V266: cotejo documental de libros con doble revisión.
- V267, V270, V271 y V272: apertura de primer libro ordinario, siguiente libro ordinario, primero y siguiente libro supletorio.
- V271 y V272: emisión y aprobación diocesana de decreto supletorio nuevo; autorización de concepto.
- V273: matriz privada para acreditación independiente de las 26 tablas maestras.
- V256: procedimiento de contador de boletas, **instalado sin GRANT** a clientes hasta cerrar la política de Parámetros V258.

Las 14 migraciones se registraron en `supabase/migrations` con sus versiones EXACTAS del historial de la base; no se reejecutan en la instancia actual.

## Comprobaciones directas
- 9/9 tablas nuevas del esquema `sacramentum_ledger` tienen RLS activo.
- 15/15 RPC públicas nuevas sin EXECUTE para `anon` y `authenticated`.
- `anon` y `authenticated` carecen de USAGE del esquema privado.
- Memorias y asientos activos: cero; no existe libro oficial abierto.
- Datos previos de pruebas intactos: 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia.
- Identidades activas con autenticación: 4; perfiles activos sin autenticación: 0.

## Pendientes para activar la operación real
1. Respaldo externo, restauración comprobada, revisión institucional y aprobación de las 26 tablas maestras.
2. Limpieza transaccional V268 de las 56 tablas de prueba, con recibo y verificación; no se ejecutó.
3. Endurecimiento V260 de coordenadas en las tablas existentes y cierre de Parámetros V258 en ventana revisada.
4. Corte atómico V267 de permisos de RPC antiguos/nuevos, con pruebas por roles y primera apertura manual.
5. Validación de que Vercel tenga la configuración oficial correspondiente, sin confundir despliegue de UI con apertura registral.

No desactivar bloqueos de autenticación, jurisdicción, auditoría ni numeración. El estado actual permite preparar el motor en la base real manteniendo el corte oficial cerrado.
