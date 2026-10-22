# SACRAMENTUM · AUDITORÍA DE EFECTOS REGISTRALES V115–V117

Fecha institucional: 21/10/2026 (Colombia). Directorio canónico: C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Resumen técnico comprobado
- 8 rutas conductuales: Bautismo, Confirmación, Matrimonio y Exequias × (corrección y reposición), con emisión y reversión.
- Corrección: original anulada, nueva partida supletoria generada y vinculada; reversión recupera original y deja supletoria sin efecto.
- Reposición: crea partida supletoria sin inventar un original; reversión conserva trazabilidad y la deja sin efecto.
- Notificaciones, notas marginales y auditoría verificadas en las rutas probadas.
- 24 intentos de emisión improcedente desde Parroquia, Diócesis y Admin General fueron rechazados.
- 4 intentos de segunda reversión fueron rechazados en Bautismo y Confirmación (dos operaciones por sacramento).
- Todas las pruebas SQL finalizaron en ROLLBACK. Nueve conteos de residuos QA consultados y resultaron cero.

## Hallazgos reales corregidos
- V115 disambiguate_supplementary_notifications: campo decree_id ambiguo dentro de ON CONFLICT de reposición de Bautismo/Confirmación.
- V116 qualify_confirmation_supplementary_coordinate: campos book_number, folio y number ambiguos en búsqueda de coordenada ocupada de Confirmación.
- V117 reversal_marginal_notes_baptism_confirmation: reversión original marcaba notas previas como reversed pero no documentaba reversión mediante una nueva nota activa. Ahora crea 2 notas para corrección o 1 para reposición, y rechaza segundo intento.

## Evidencias reproducibles
- scripts/qa-rollback-repositions-v115.sql
- scripts/qa-rollback-corrections-v115.sql
- scripts/qa-rollback-baptism-confirmation-v115.sql
- scripts/qa-rollback-decree-role-matrix-v115.sql
- scripts/test-register-effects-migrations-v116.mjs
- supabase/migrations/*_v115.sql, *_v116.sql, *_v117.sql
- AUDITORIA_PUERTA_CALIDAD_V117.json: 515/515 sintéticas; 25/25 tareas de gate, incluye 23 verificadores y compilación.

## Estado del plan maestro
{"APROBADO":9,"EN_PROGRESO":91,"PENDIENTE":224,"FALLIDO":1}
Controles con nueva evidencia: 24. Ninguno se marcó APROBADO sin un cierre funcional completo.

## Límites e impedimentos para certificar
- Estas pruebas se ejecutaron contra Supabase con transacciones reversibles; no equivalen a un entorno de staging independiente.
- Falta navegación real de todos los roles, impresión y cotejo de documentos físicos, importaciones históricas y restauración aislada de respaldos.
- No se probaron operaciones concurrentes en conexiones múltiples ni interrupciones de red en medio de un commit.
- La auditoría npm 30.02 continúa FALLIDA/no cerrada, con advertencias de seguridad conocidas; el gate la omitió expresamente.
- Las sentencias atribuidas al Tribunal requieren revisión jurídico-documental por autoridad competente.

Dictamen: backend de las 8 rutas E2E ficticias probadas con rollback, sin certificación global de SACRAMENTUM.
