# SACRAMENTUM · SEGURIDAD HISTÓRICA Y NAVEGACIÓN ANÓNIMA V119–V120

## Hechos comprobados
- Navegador Chrome headless local en siete rutas: portada escritorio/móvil, acceso móvil y cuatro rutas institucionales protegidas.
- Segunda ejecución con espera explícita de render React: 7/7 PASS. La primera ejecución fría fue 5/7 por ausencia temporal de contenido renderizado al optimizar dependencias de Vite.
- Las cuatro rutas privadas se redirigen a / cuando el visitante no tiene sesión. No muestran expedientes.
- Evidencias PNG y SHA-256 en AUDITORIA_EVIDENCIA_VISUAL_V119, informe AUDITORIA_NAVEGADOR_ANONIMO_V119.json.

## Hallazgos críticos corregidos
- RLS en legacy_source_origins: una instalación propia podía hacer visible a Cancillería un origen histórico mapeado a parroquia de otra diócesis; reproducido antes como visible=1.
- RLS en legacy_archive_records: una fila con parish_id de diócesis ajena y diocese_id propia se mostraba por una condición OR; reproducido antes como visible=1.
- Migración Supabase V120: supabase/migrations/20261022130415_isolate_historical_origins_by_diocese_v120.sql. Dos ALTER POLICY preservan RLS y fuerzan pertenencia coherente.
- Test scripts/qa-rollback-cross-diocese-rls-v120.sql: Chancery, Diocese, Parish y Admin General con filas ficticias locales, extranjeras e inconsistentes. PASS tras corrección; finaliza con ROLLBACK.
- La política mantiene la consulta legítima de 7 expedientes ANULACION y 2 orígenes para Cancillería.
- La Parroquia no puede consultar metadatos de instalaciones históricas; sí puede consultar su propio registro bajo su política.

## Integridad post-test
- Archivos reales: 5 antecedentes pendientes y 2 con decreto vinculado, sin cambios.
- Cero residuos ficticios en orígenes, filas históricas, diócesis y parroquias V120.

## Calidad
- Regresión V120: 535/535 pruebas sintéticas, 25/25 verificaciones, build de producción correcto.
- El control de npm audit continúa abierto/fallido; gate ejecutado con --sin-auditoria-dependencias.
- Supabase Advisor detecta visibilidad de 64 objetos para GraphQL authenticated. El dato requiere revisar RLS y no prueba automáticamente acceso cruzado.

## Limitaciones precisas
- Las capturas son de navegación sin autenticación: no certifican UX ni permisos efectivos dentro de Cancillería, Diócesis y Parroquia.
- Falta navegación autenticada real y evaluación visual individual de todas las pantallas, impresión, importaciones, notificaciones, rendimiento y recuperación de backup.
- No se ha desplegado frontend de la rama audit/v113-build-tool-risk.

## Estado de auditoría
- 325 controles, 18 con evidencia añadida en este ciclo. Totales: {"APROBADO":9,"EN_PROGRESO":99,"PENDIENTE":216,"FALLIDO":1}.
- No se convirtió ninguna prueba estática en certificación integral.
