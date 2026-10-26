# SACRAMENTUM FINAL · Auditoría V218 — Revisión institucional del registro histórico

**Fecha:** 26 de octubre de 2026. Carpeta: `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Resultados reales sin modificar sacramentos

El inventario anterior detectó 219 enlaces sin expediente actualmente localizable. En V218 se verificó que los **219** pertenecen a **2 lotes históricos** (`BAUTIZOS`: 46 y `CONFIRMA`: 173), alojados en **una parroquia de una sola diócesis**. Las 219 filas de staging originales permanecen en estado `imported`; un identificador de destino no encontrado **no demuestra** que una partida haya sido borrada.

## Nueva función segura de Cancillería

- **Ruta protegida:** `/chancery/historicos/conciliacion`, accesible desde el Panel de Cancillería.
- **Visualización:** recuento jurisdiccional por Bautismo/Confirmación, paginación, referencia de origen, libro/folio/número sin exponer de forma indiscriminada datos personales.
- **Investigación y trazabilidad:** constancia append-only de fuente verificada, en investigación, no localizada o escalada a revisión jurídica, con referencia documental obligatoria.
- **Sin modificaciones sacramentales:** el sistema NO crea partidas, NO cambia UUID de destino, NO marca casos como corregidos y NO emite decretos con el mero registro de una constancia.
- **Datos institucionales aislados:** cambio de sesión/rol/diócesis no deja visibles los casos anteriores.

### Arquitectura PostgreSQL

Migración `supabase/migrations/20261026133625_chancery_historical_link_review_v218.sql`:
- Tabla de eventos `legacy_link_review_events_v218` con RLS, sin permisos directos de `anon` ni de usuarios `authenticated`.
- RPC de resumen `summarize_unresolved_legacy_links_v218()`, solo Cancillería activa.
- RPC de casos `list_unresolved_legacy_links_v218(p_parish_id,p_limit,p_offset)`, con límites estrictos y parroquias de la diócesis activa.
- RPC `record_unresolved_legacy_link_review_v218(...)`, únicamente agrega evidencia para casos realmente pendientes.
- `SECURITY DEFINER` con `search_path` vacío y **verificación explícita de `auth.uid()`, rol, estado, Cancillería y jurisdicción**; se revoca ejecución pública y anónima.

## Evidencia SQL real (100 % reversible)

En el Supabase real, sin persistir datos de prueba:
1. Resumen correcto de 219 casos: 46 Bautismo y 173 Confirmación.
2. Paginación comprobada: 100 + 100 + 19.
3. Un canciller autorizado pudo visualizar casos y registrar una constancia ficticia, dentro de `BEGIN/ROLLBACK`.
4. Usuarios de Parroquia, otras diócesis y anónimos **denegados**.
5. Lectura directa de tabla interna denegada.
6. Se rechazaron referencias documentales muy cortas y estados de conciliación no autorizados.
7. Conteos de vínculos, bautizos y confirmaciones **sin alteración**.

Archivo: `scripts/qa-rollback-chancery-unresolved-review-v218.sql`.

## Evidencia de interfaz (Chrome aislado)

**7/7** escenarios de `HistoricalLinkReviewPage.jsx`: presentación de 219 casos, rechazo de constancia incompleta, registro en servicio simulado, navegación hasta página 5, ocultamiento tras cambio a usuario parroquial o diócesis distinta, recuperación al retornar a Cancillería autorizada. **0 excepciones JavaScript, 0 solicitudes externas.** Esta evidencia valida el componente React real con RPC simuladas; la autorización real se probó separadamente en PostgreSQL.

## Puerta local y entrega

**1.854/1.854** ensayos sintéticos, **30/30** controles rigurosos, compilación Vite y dependencias sin vulnerabilidades detectadas. El test de perímetro histórico V175 fue corregido para preservar sin alteraciones su evidencia real de 107 rutas antiguas, y exigir que toda ruta posterior esté protegida, sin atribuir la auditoría antigua a una ruta que no existía entonces.

La migración se aplicará definitivamente **solo después de GitHub CI verde**, con su versión remota sincronizada y repetición de los SQL en `ROLLBACK`.

## Limitaciones verificables

- **Las 219 referencias aún requieren intervención real de Cancillería y cotejo con libro físico/archivo fuente/decretos; ninguna se reparó automáticamente.**
- No se certificó correo real de recuperación ni impresión física.
- Faltan pruebas positivas con sesiones reales para el ciclo completo de todos los roles.

## Estimación ponderada de avance

**87 %** (resultado ponderado 87.20 %). Estimación conservadora por áreas, **no** porcentaje exacto de código ejecutado ni certificado de ausencia de defectos. La actualización respecto a V217 refleja la creación y validación del módulo de revisión institucional; no se adjudica resolución de los 219 casos.

| Área | Peso | Avance estimado |
|---|---:|---:|
| Infraestructura, CI y despliegue | 10 % | 97 % |
| Roles, jerarquía y separación institucional | 10 % | 93 % |
| Registros y pendientes de cuatro sacramentos | 20 % | 91 % |
| Cancillería, decretos y trazabilidad jurídica | 15 % | 88 % |
| Migración histórica e integridad de procedencia | 15 % | 87 % |
| Notas marginales y reconciliación | 10 % | 91 % |
| Reportes, chat y notificaciones | 8 % | 80 % |
| Documentos, constancias e impresión | 7 % | 75 % |
| Aceptación E2E y operaciones reales | 5 % | 60 % |

Documentos: `AUDITORIA_REVISION_HISTORICA_SQL_V218.json`, `AUDITORIA_REVISION_HISTORICA_BROWSER_V218.json`, `AUDITORIA_PUERTA_CALIDAD_V218.json`, `AUDITORIA_AVANCE_GLOBAL_V218.json`.
