# SACRAMENTUM — Auditoría extrema V175: perímetro real y rutas privadas



Fecha: 23 de octubre de 2026. Ruta: C:\SACRAMENTUM\SACRAMENTUM_FINAL.



## Pruebas ejecutadas por la auditoría



**Local:** 107 de 107 rutas React navegadas con Chrome real sin sesión, 58 protegidas y 49 redirecciones, todas terminaron en el login. Cero excepciones JS observadas y sin desbordamiento horizontal en los viewports ensayados.

**Producción Vercel:** el mismo barrido de 107 de 107 rutas directamente sobre https://sacramentum-final.vercel.app, sin sesión ni cookies previas; resultado aprobado.

**API real Supabase:** 15 endpoints privados consultados con la clave pública y sin sesión; todos denegados HTTP 401 código PostgreSQL 42501 (no clave inválida), sin obtener filas sacramentales ni institucionales.

**Puerta de calidad:** 1.292/1.292 pruebas sintéticas y 28/28 verificaciones estrictas, build, CSS y auditorías de dependencias.

**Cobertura SQL acumulada anterior:** 75 de 75 regresiones actuales vigentes, documentadas en V174.



## Hallazgos y riesgos que permanecen abiertos



La CLI Supabase del computador devolvió HTTP 403 al intentar conexión directa. Dos consultas SQL concurrentes a través de Management API no demostraron un mismo bloqueo transaccional observado en dos backends. NO se certifica todavía la concurrencia física.

La versión publicada aún necesita auditoría E2E con inicios de sesión separados de dos diócesis y revisión funcional autenticada en todas las pantallas y formularios. La prueba de rutas anónimas no sustituye esas comprobaciones.

El asesor oficial de Supabase devolvió: 3 tablas RLS intencionalmente sin políticas (INFO); 64 objetos detectados como visibles en esquema GraphQL para authenticated (WARN); 146 funciones SECURITY DEFINER ejecutables por authenticated (WARN); una advertencia de protección ante contraseñas filtradas; 26 claves foráneas sin índice y 93 índices marcados sin uso. Son ALERTAS A REVISAR por caso, no evidencia de que todos los objetos sean vulnerables o que los índices puedan eliminarse indiscriminadamente.

Se priorizan la configuración de contraseñas filtradas, la revisión individual de funciones privilegiadas y el análisis medido de índices. No se cambiaron credenciales ni datos de producción.



## Metodología y límites



Se usaron Chrome con perfil anónimo nuevo, el build local de producción y el despliegue público Vercel. El examen REST usó únicamente la clave pública sin revelar su valor. No se copiaron tokens reales de usuario; la información privada no se exportó.

Los resultados están en AUDITORIA_RUTAS_ANONIMAS_V175.json, AUDITORIA_RUTAS_PRODUCCION_V175.json, AUDITORIA_DATA_API_ANONIMA_V175.json, AUDITORIA_CONSOLIDADO_V175.json y AUDITORIA_PUERTA_CALIDAD_V175.json.



El plan maestro conserva 325 controles: 10 aprobados, 117 en progreso y 198 pendientes. La certificación total de la aplicación sigue abierta.
