# SACRAMENTUM · AUDITORÍA DE DECRETOS Y PRUEBAS FICTICIAS V114

Proyecto: C:\SACRAMENTUM\SACRAMENTUM_FINAL; versión de prueba local, no publicado.

## Hechos ejecutados y verificables
- Migraciones V111/V112/V113 aplicadas en Supabase. V113 replica la lectura de aclaraciones con autorización de Cancillería o Diócesis y sin lectura directa de tabla.
- Panel compartido de recepción judicial y aclaraciones conectado a Cancillería y Diócesis. Build Vite: aprobado; faltan pruebas visuales con sesión real.
- scripts/qa-rollback-tribunal-v114.sql: expediente matrimonial + nulidad + doble cotejo contradictorio + requerimiento + rechazo duplicado + Parroquia denegada para responder/consultar + respuesta Cancillería.
- scripts/qa-rollback-documentary-v114.sql: cuatro sacramentos, decretos nuevos y antecedentes documentales históricos; permisos indebidos rechazados, colisión de número, histórica sin procedencia y expedición nueva en contenedor histórico rechazadas.
- Después de reejecución de las transacciones: cero QA en casos, recepciones, cotejos, aclaraciones, Matrimonios y decretos de prueba.
- 52 combinaciones sintéticas de tipo, origen y parroquia con 56 pruebas: aprobado.
- Puerta V114: 25/25 verificaciones, 501 pruebas sintéticas (según informe); incluye 23 verificadores históricos y build.

## Banco maestro ficticio SIN ejecutar
- 7800 casos catalogados de 325 criterios × cuatro roles × seis variantes adversariales.
- Ejecutados 0, aprobados 0. Esto es planificación operativa, no una certificación.

## Hallazgos abiertos
- 30.02 npm audit: FALLIDO por alertas altas previas y fallo de red al intentar actualizar; no se declara seguro.
- No están certificados los ciclos completos de celebración-asiento-impresión-importación para los cuatro sacramentos.
- No están completas todas las pruebas RLS y RPC entre diócesis, ni la concurrencia real entre sesiones.
- No está comprobada visualmente cada pantalla en Firefox y móvil, ni restauración de respaldo en entorno desechable.
- La legitimidad del documento judicial debe verificarse por autoridad competente; ningún algoritmo convierte cotejos en aprobación.

## Estado de los 325 controles
{"APROBADO":9,"EN_PROGRESO":77,"PENDIENTE":238,"FALLIDO":1}

La fuente canónica sigue siendo AUDITORIA_MAESTRA_CONTROLES_V90.json. Ningún nuevo control se ha marcado APROBADO solo por estos ensayos.
Todas las pruebas SQL de esta fase finalizan con ROLLBACK.
