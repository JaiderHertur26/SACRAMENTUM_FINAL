# SACRAMENTUM FINAL — cierre técnico V217: vínculos registrales históricos

**Fecha:** 26 de octubre de 2026. **Carpeta:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Fallo reproducido (datos 100 % ficticios, BEGIN/ROLLBACK)

En `legacy_record_links` las importaciones antiguas podían utilizar `ON CONFLICT ... DO UPDATE` para modificar lote, fila y destino de una clave histórica. Se reprodujo con dos parroquias autorizadas que tenían dos partidas ficticias de Bautismo de idéntico nombre, apellidos y fecha, pero distinta parroquia: la segunda sobrescribió el vínculo original. El guardia anterior validaba identidad y fecha, **pero no la parroquia física ni la procedencia original**. No se alteraron registros reales; todo se revirtió.

## Solución V217

`supabase/migrations/20261026125750_guard_generic_legacy_registral_links_v217.sql` modifica de manera versionada el disparador común `sacramentum_guard_legacy_record_link_identity` sin reescribir filas históricas:
- Exclusión mutua por clave de procedencia; comprobación de lote y fila de staging del mismo sistema/perfil/clave.
- Validación de parroquia del lote y del destino físico, incluyendo Bautismo, Confirmación, Matrimonio, Exequias, preinscripciones, notas marginales y cola histórica.
- Prohibición de cambiar un vínculo existente a otra parroquia, otra tabla registral, otro UUID, sistema, perfil o clave histórica, incluso para escapar hacia un catálogo.
- Respeta la validación original de nombre y fecha y **permite el reintento legítimo sobre el mismo registro y parroquia**.
- Mantiene fuera del alcance los catálogos globales (diocesis, iglesias y diccionarios), cuya semántica multiinstitucional exige auditoría independiente.
- Falla cerrado si el cuerpo de la función cambió; no elimina ni corrige registros antiguos.

Se verificó en cuatro familias mediante SQL reversibles: **4 sobrescrituras prohibidas, 4 destinos de parroquia ajena rechazados, 4 reintentos propios válidos y 4 vínculos originales preservados**.

## Inventario histórico — solo lectura

| Familia | Vínculos | Partidas existentes y parroquia correcta | Destino no localizable | Partidas existentes en otra parroquia |
|---|---:|---:|---:|---:|
| Bautismo | 5.084 | 5.038 | 46 | 0 |
| Confirmación | 2.263 | 2.090 | 173 | 0 |
| Matrimonio | 1.260 | 1.260 | 0 | 0 |
| Exequias | 0 | 0 | 0 | 0 |
| **Total** | **8.607** | **8.388** | **219** | **0** |

Los 219 vínculos sin `target_id` actualmente localizable no demuestran por sí solos que se haya borrado una partida; tampoco autorizan reasignarla. **Se conservaron sin alteraciones**, con seguimiento en [issue #67](https://github.com/JaiderHertur26/SACRAMENTUM_FINAL/issues/67).

## Calidad y alcance

- **1.813/1.813** pruebas automatizadas aprobadas localmente.
- **30/30** controles completos aprobados.
- Build Vite, frontera de secretos y auditoría de dependencias aprobados.
- Scripts SQL ficticios bajo `scripts/qa-rollback-generic-link-*.sql` finalizan con `ROLLBACK`.
- Lecturas seguras bajo `scripts/qa-readonly-legacy-link-inventory-v217.sql`.

La migración se instala oficialmente solo después de CI independiente verde. La aprobación de estos escenarios no equivale a certificar todos los recorridos de usuario final, correo de recuperación o impresión física.

## Porcentaje global del proyecto

**Estimación de cierre técnico: 86 %** (rúbrica ponderada sobre nueve dominios; resultado bruto 85.65 %). No es una medición objetiva por líneas de código ni una garantía de producción libre de problemas. Los porcentajes por bloque son estimaciones prudenciales de avance, sujetos a la certificación funcional final.

| Área de trabajo | Peso | Avance estimado |
|---|---:|---:|
| Infraestructura, CI y despliegue | 10 % | 97 % |
| Roles, jerarquía y separación institucional | 10 % | 92 % |
| Registros y pendientes de los cuatro sacramentos | 20 % | 91 % |
| Cancillería, decretos y trazabilidad jurídica | 15 % | 83 % |
| Migración histórica e integridad de procedencia | 15 % | 84 % |
| Notas marginales y reconciliación | 10 % | 91 % |
| Reportes, chat y notificaciones | 8 % | 80 % |
| Documentos, constancias e impresión | 7 % | 75 % |
| Aceptación E2E y operaciones reales | 5 % | 55 % |

Falta principalmente conciliar el historial sin destino, completar matrices reales de Cancillería, probar recepción efectiva de contraseñas, impresión y regresiones integrales con todos los roles.

**Evidencias:** `AUDITORIA_VINCULOS_V217.json`, `AUDITORIA_AVANCE_GLOBAL_V217.json`, `AUDITORIA_PUERTA_CALIDAD_V217.json` y pruebas de cuatro familias SQL.
