# SACRAMENTUM FINAL — V174 | Cobertura integral de SQL reversible

Fecha: 23 de octubre de 2026. Carpeta: C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Alcance real comprobado

- Inventario: 97 archivos SQL reversibles de pruebas.
- Regresiones funcionales vigentes: 75, con prueba satisfactoria nominal acreditada para las 75.
- Puerta de calidad V174: 1.285/1.285 pruebas sintéticas, 28/28 verificaciones, build y auditoría de dependencias aprobados.
- Evidencia histórica reutilizada: 30 aprobadas en V172 y V173, documentadas en sus respectivos registros.
- Nuevas ejecuciones V174: 45, integradas por 43 guiones existentes y dos guiones nuevos de denegación.
- Archivo histórico: 22 reproducciones de vulnerabilidades anteriores, NO contadas como regresiones que deban aprobar hoy.

Dos scripts antiguos sin sufijo baseline esperaban reproducir una vulnerabilidad en notificaciones y nulidades. Ambos fueron rechazados por las nuevas salvaguardas y se conservan solo como reproducción histórica; sus reemplazos V174 exigen denegaciones específicas y la conservación del estado del documento, con resultado correcto.

Los flujos SQL comprobados abarcan los cuatro sacramentos, decretos, Cancillería, RLS, notas marginales, nulidad, digitalización e importación histórica, impresión registral, notificaciones, chat, transiciones, auditoría y trazabilidad.

## Integridad y limpieza

Ocho consultas de control sobre parroquias, jurisdicción de decretos y conciliaciones, importaciones y Cancillería devolvieron cero anomalías. Los registros existentes mantuvieron los recuentos comprobados de 5.040 Bautismos, 2.091 Confirmaciones, 1.261 Matrimonios, 1 Exequia, 2 Decretos y 82 Notas marginales. No hay residuos QA-V174 en las cuatro categorías examinadas.

Todas las nuevas pruebas SQL se ejecutaron individualmente dentro de BEGIN/ROLLBACK. La cobertura nominal acumulada no equivale a un test simultáneo, ni prueba integral de rendimiento.

## Pendientes expresos

- Dos sesiones autenticadas reales de distintas diócesis.
- Dos transacciones físicas PostgreSQL efectivamente solapadas.
- Navegación E2E de todas las pantallas, capturas, permisos y formularios.
- Pruebas de carga, latencia, interrupción de red y recuperación.

## Evidencias

AUDITORIA_INVENTARIO_SQL_V174.json, AUDITORIA_RESULTADOS_SQL_V174.json, guiones qa-rollback-*.sql, auditorías V172/V173 y puerta estricta de calidad.

Plan maestro sin promociones indebidas: 10 APROBADO, 117 EN_PROGRESO, 198 PENDIENTE (325 en total).
