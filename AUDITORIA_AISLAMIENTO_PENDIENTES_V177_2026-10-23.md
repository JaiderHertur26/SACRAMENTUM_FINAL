# SACRAMENTUM FINAL · V177 — Cuatro sacramentos: bloqueo de creación pendiente para cuentas suspendidas



Fecha: 23 de octubre de 2026. Ruta principal: C:\SACRAMENTUM\SACRAMENTUM_FINAL.



## Vulnerabilidad real

El control de las funciones SECURITY DEFINER create_pending_baptism, create_pending_confirmation, create_pending_marriage y create_pending_funeral exigía pertenencia parroquial y en ciertas funciones is_active, pero no aseguraba estado ACTIVE. Se demostró directamente en Supabase que un perfil parroquial SUSPENDED podía crear cuatro registros pendientes ficticios, pese a carecer de permisos en la función central current_app_role de V176.

Todas esas creaciones estaban en transacciones PostgreSQL BEGIN/ROLLBACK. No se modificaron permanentemente partidas, parámetros de numeración, perfiles ni logs.



## Reparación V177

Migración 20261023205143_pending_sacraments_active_parish_v177.sql cambia únicamente los filtros de autorización de cuatro funciones, exigiendo is_active IS TRUE, upper(status)=ACTIVE y coincidencia entre parroquia de destino y diócesis del perfil. Las coordenadas físicas Libro/Folio/Número, flujo de registro, auditoría y firmas RPC permanecen intactos.

La migración usa anclajes de definiciones actuales y aborta si falta, se duplica o cambia el fragmento objetivo.



## Resultado de QA real

4/4 operaciones permitidas de usuario parroquial ACTIVE terminaron correctamente dentro de ROLLBACK.

24/24 intentos no autorizados fueron rechazados con los errores institucionales correctos: SUSPENDED, NULL_STATUS, NULL_ACTIVE, DISABLED, FOREIGN_DIOCESE y DIOCESE_ROLE (cada escenario aplicado a los cuatro sacramentos). Los rechazos dejaron los cuatro registros ficticios legítimos intactos dentro de la transacción, confirmándose un registro por sacramento.

Posteriormente se verificó ausencia de residuos en auth.users, dioceses, pending_baptisms, pending_confirmations, pending_marriages y pending_funerals.



## Calidad de software y límites

16 nuevos contratos permanentes, 1.324 de 1.324 pruebas sintéticas y 28 de 28 controles de calidad, incluyendo build, CSS y auditoría de dependencias.

El control de RLS para bishop_tenures se examinó durante la exploración y NO fue reproducido como fuga de datos con status NULL; no se comunica como nueva vulnerabilidad.

Persisten sin certificación las pruebas auténticas de dos sesiones diocesanas independientes, transacciones físicamente simultáneas, recorrido visual de todas las acciones autenticadas y carga.

Plan maestro: 325 controles, 10 APROBADO, 117 EN_PROGRESO y 198 PENDIENTE. Ningún control se promueve sin prueba exhaustiva.
