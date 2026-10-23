# SACRAMENTUM · V172 — Auditoría integral y aislamiento episcopal

**Fecha:** 23 de octubre de 2026. **Carpeta:** C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Estado de pruebas ejecutadas
- **1262/1262 pruebas sintéticas Node**; **28/28 gates**, incluidas compilación, CSS, pruebas heredadas e informes de seguridad de dependencias.
- **21 guiones de PostgreSQL reales con BEGIN/ROLLBACK**, aprobados y sin cambios persistentes; cubren impresión de cuatro sacramentos, notas marginales, decretos, correcciones, nulidad, chat, procedencia histórica, permisos, importaciones y notificaciones.
- **2 pruebas SQL** fueron bloqueadas por el sistema de seguridad antes de su ejecución; **no** se presentan como aprobadas ni como defectos de aplicación.
- **69 guiones adicionales del inventario** no se ejecutaron durante esta pasada.
- **11 verificaciones de integridad de datos en lectura**: ninguna inconsistencia en las condiciones consultadas (jurisdicciones, notas/partidas, relaciones de parroquia, claves activas de Cancillería). Esto no demuestra que todos los datos sean correctos.
- Conjunto consultado: 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia, 2 Decretos y 82 Notas marginales.

## Vulnerabilidad P0 reproducida y mitigada
La política RLS de `public.bishop_tenures` daba visibilidad y eliminación de cualquier registro a un usuario con rol `diocese` o `archdiocese`, sin comprobar que perteneciera a la diócesis del registro. Se reprodujo con una cuenta de diócesis A ficticia y un período episcopal ficticio asociado a una parroquia de otra jurisdicción; SELECT y DELETE fueron permitidos. Toda la operación terminó con ROLLBACK.

Migración `supabase/migrations/20261023185600_isolate_bishop_tenures_by_diocese_v172.sql` cierra las cuatro políticas de SELECT, INSERT, UPDATE, DELETE y exige un perfil institucional activo, pertenencia diocesana real, y limita a cada parroquia a sus períodos. Admin General mantiene alcance global autorizado.

Verificación SQL de migración aplicada solo dentro de transacción: ajenos no pueden leer, crear, modificar ni eliminar; propia parroquia puede operar y Administrador General consultar; usuario suspendido rechazado. Pruebas ficticias y reversibles. La migración permanente debe alinearse con la versión realmente asignada por Supabase antes de fusionar.

## Trazabilidad y límites
- Inventario legible por máquina: `AUDITORIA_PRUEBAS_INTEGRALES_V172.json`; reproducibles disponibles como scripts SQL en `scripts`.
- Quedan pendientes autenticación E2E real entre diócesis, concurrencia física de dos conexiones PostgreSQL y verificación de los restantes guiones; **no declarar auditoría total certificada**.
- Plan maestro {"APROBADO":10,"EN_PROGRESO":117,"PENDIENTE":198}; ningún control P0 pendiente ha sido promovido a aprobado.
