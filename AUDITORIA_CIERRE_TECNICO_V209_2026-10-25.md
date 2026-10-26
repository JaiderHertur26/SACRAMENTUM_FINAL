# SACRAMENTUM FINAL — Auditoría y endurecimiento V209

**Fecha local:** 25 de octubre de 2026, Colombia (registro UTC: 26 de octubre).

**Rama:** `audit/v209-real-dynamic-routes-and-security`

**Base:** V208 incorporada en `main` (`4c3af0c`).

## Cambios implementados

1. **Asociación inequívoca de identidad:** `AuthContext.loadProfile` exige que `auth_user_id` corresponda a `authUser.id`. Como compatibilidad heredada, si falta `auth_user_id`, solo acepta la fila cuyo propio `id` sea idéntico al del usuario de GoTrue. La búsqueda por correo no otorga por sí misma autoridad.
2. **Detalles de Bautismo:** la pantalla enlaza el registro cargado al par (parroquia, ID de partida). Si cambia la ruta o el ámbito, no representa el registro anterior mientras consulta.
3. **Detalles de decretos parroquiales:** se aplica el mismo cierre frente a respuestas tardías, se usa `parish_id` del usuario autenticado y se resuelve la ausencia de contexto sin dejar el cargador indefinidamente.
4. **Compatibilidad V14:** se ajusta el verificador histórico para comprobar el filtro parroquial usando su variable canónica, sin suprimir el control.
5. **Cobertura V209:** nueve pruebas nuevas en la puerta de calidad y dos rutas de detalle recorridas en navegador mediante sesiones reales y acciones de solo lectura.

## Resultados verificables

| Comprobación | Resultado |
|---|---|
| Batería automatizada acumulada V89–V209 | **1.627/1.627 aprobadas** |
| Puerta de calidad estricta | **30/30 aprobadas** |
| Navegación real de rutas dinámicas | **16/16 aprobadas** |
| Identidad institucional y proyección contextual | **9/9 pruebas nuevas aprobadas** |
| Excepciones de JavaScript en la exploración V209 | **0** |
| Solicitudes externas inesperadas en navegador QA | **0** |
| Compilación Vite y auditoría npm | **Aprobadas**, sin hallazgos npm |

Evidencias: `AUDITORIA_PUERTA_CALIDAD_V209.json`, `AUDITORIA_RUTAS_DINAMICAS_V209.json`, `AUDITORIA_RUTAS_INVENTARIO_V209.json`.

## Alcance y límites

La auditoría de navegador usa cuatro roles autenticados con cuentas ficticias; cubre identificadores malformados o inexistentes y redirecciones por rol. **No demuestra apertura satisfactoria de una partida existente, cruce de partidas existentes entre parroquias, entrega efectiva de correo de recuperación, ni CRUD completo.** Los expedientes oficiales y datos reales no fueron editados en esta fase.

La auditoría de rutas es de solo lectura. La prueba de acceso por identidad incluye caso positivo legítimo, caso heredado legítimo y negativas para identidades cruzadas.

## Ruta de cierre siguiente

Priorizar evidencias positivas con partidas y decretos 100 % ficticios en entorno controlado, la emisión por Cancillería, vínculos antiguos importados y recuperación íntegra por correo (sin publicar credenciales ni datos personales). Mantener la puerta estricta y GitHub Actions como requisito de fusión antes de pasar a Vercel.
