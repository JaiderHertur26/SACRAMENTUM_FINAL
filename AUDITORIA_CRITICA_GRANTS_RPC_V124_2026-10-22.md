# SACRAMENTUM · SEGURIDAD CRÍTICA Y RPC PRIVILEGIADAS V122–V124

## Hallazgo P0 · TRUNCATE pese a RLS
- Antes: authenticated podía TRUNCATE, REFERENCES, TRIGGER y MAINTAIN en 57 de 78 tablas públicas, incluidos libros sacramentales y usuarios.
- V122 aplicada: REVOKE de cuatro privilegios en todas las tablas de public. **0 grants peligrosos** en 78 tablas; no se ejecutó ningún TRUNCATE.
- Prueba SQL SET LOCAL ROLE authenticated confirmó cero permisos peligrosos y SELECT preservado en seis tablas esenciales.
- Default ACL de tablas nuevas creadas por postgres también corregida.
- **Pendiente externo y NO resuelto:** default ACL de supabase_admin conserva grants automáticos incluidos TRUNCATE. Intento reversible de modificación recibió 42501 por falta de permisos; exige intervención de propietario/administrador de plataforma.

## Hallazgo P0 · posible eliminación de Confirmación vigente
- Antes: reconcile_legacy_confirmation_shadows_v74 eliminó realmente, en transacción revertida, una Confirmación manual y vigente al coincidir libro/folio/número y nombre fuente.
- V123 aplicada: sólo duplica sombra importada (raw_data.source=legacy_import), anulada/revertida, con contraparte vigente, patrón fuente literal >=6 caracteres sin comodines.
- Ensayo negativo original PASS tras arreglo: la Confirmación manual vigente no desaparece.
- Ensayo positivo/negativo: 1 sombra importada y reverted eliminada, 2 controles vigentes retenidos, segundo intento 0 eliminaciones, comodines rechazados; ROLLBACK.

## V124 · Independencia de roles y jurisdicción
- reconcile_legacy_baptism_shadows_v73 y reconcile_legacy_confirmation_shadows_v74 limitadas al rol Diócesis en su propia diócesis.
- Administrador General, Cancillería y Parroquia ya no pueden efectuar limpieza sacramental directa.
- Matriz transaccional: 2 ejecuciones vacías autorizadas para Diócesis, 6 llamadas improcedentes rechazadas, dos parroquias ficticias sin persistencia.

## Inventario de 133 RPC SECURITY DEFINER
- AUDITORIA_RPC_PRIVILEGIADAS_V123.json incluye firma, heurística de riesgo y estado de revisión; no contiene información personal.
- 133 ejecutables por authenticated, 0 ejecutables por anon.
- 2 RPC destructivas parcialmente verificadas en V123/V124. **Otras 131 sin auditoría individual completa.**
- El análisis por palabra clave es un selector de prioridad, NO garantía de autorización; las RPC pueden delegar operaciones a otras funciones.

## Regresión y datos protegidos
- Gate AUDITORIA_PUERTA_CALIDAD_V124.json: 562 pruebas sintéticas aprobadas, 25/25 verificadores, compilación correcta.
- Cero residuos QA en Confirmaciones, parroquias y auditoría. ANULACION permanece con 5 archivados pendientes y 2 vinculados.
- Cambios backend instalados Supabase con migraciones 20261022133020 (V122), 20261022133354 (V123) y 20261022134101 (V124).
- Cambios frontend de esta fase: ninguno; la rama audit/v113-build-tool-risk NO desplegada.

## Bloqueos para certificación final
- npm audit control 30.02 sigue FALLIDO (gate omitió dependencias de forma expresa).
- Security Advisor: 64 avisos WARN de exposición GraphQL y 133 WARN de funciones SECURITY DEFINER; no equivalen automáticamente a vulnerabilidades explotables.
- Auth leaked password protection: WARN; revisar/activar con permisos de administración Auth.
- Default privileges de supabase_admin requieren propietario autorizado para corregir concesiones futuras.
- Faltan pruebas UI con usuarios autenticados, impresión, importaciones integrales, seguridad por cada RPC y concurrencia entre sesiones.

## Plan maestro
- 20 controles con nueva evidencia; estados {"APROBADO":9,"EN_PROGRESO":102,"PENDIENTE":213,"FALLIDO":1}. No se han aprobado controles globales por estos ensayos aislados.

Dictamen: dos fallos críticos corregidos y comprobados, sin certificación global del sistema.
