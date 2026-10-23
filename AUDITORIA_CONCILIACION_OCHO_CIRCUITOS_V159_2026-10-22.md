# SACRAMENTUM · Auditoría V159
## Conciliación institucional en cuatro sacramentos: corrección y reposición

**Fecha:** 22 de octubre de 2026. **Backend:** Supabase REGISTRO SACRAMENTOS.

### Pruebas efectivamente ejecutadas
Se ejecutaron dos matrices SQL reales sobre Supabase. La primera ejercitó las cuatro reposiciones (Bautismo, Confirmación, Matrimonio y Exequias); la segunda, las cuatro correcciones. Cada matriz usó registros enteramente ficticios dentro de BEGIN/ROLLBACK.

Los ocho casos cumplieron el circuito: expediente solicitado por Cancillería, intento de ejecución sin autorización rechazado, autorización por Diócesis mediante otra identidad y ejecución final por Cancillería.

Para cada reposición se verificó decreto, partida supletoria, nota y expediente en estado reversed/reversed/reversed/executed. Para cada corrección se comprobó además la restauración de la partida original a seated, y la supletoria reverted (reversed). En cada expediente se comprobaron tres eventos institucionales y una notificación parroquial de conciliación.

**Scripts ejecutados:**
- scripts/qa-rollback-reconciliation-all-sacraments-v159.sql
- scripts/qa-rollback-corrections-reconciliation-all-sacraments-v159.sql

Los scripts quedaron asociados a 19 pruebas de contrato en scripts/test-reconciliation-all-sacraments-v159.mjs, añadidas al gate estricto y al CI.

### Resultado de calidad
- 1057/1057 pruebas sintéticas aprobadas.
- 28/28 verificaciones del gate aprobadas.
- Compilación de producción, CSS y verificadores heredados correctos.
- Auditorías npm de dependencias de producción y desarrollo sin vulnerabilidades reportadas.
- Comprobación postprueba: cero decretos, partidas, notas y expedientes QA V159 persistidos.

### Concurrencia: pendiente real
Dos llamadas SQL obtuvieron backend PID distintos; sin embargo, un ensayo con bloqueo transaccional no demostró que se solaparan. Ambos intentos pudieron adquirir el bloqueo porque el servicio probablemente ejecutó las operaciones en secuencia. Por consiguiente NO queda certificada la sincronización FOR SHARE / FOR UPDATE bajo dos conexiones PostgreSQL simultáneas.

### Navegación visual autenticada: pendiente real
Se verificaron en código las rutas protegidas, la normalización de rol y la dependencia del perfil institucional. No se realizó la navegación física autenticada con identidades reales de Cancillería y Diócesis, ni se desplegó el frontend.

### Estado de seguridad y auditoría
No se aplicó migración ni se modificaron concesiones/RLS; el inventario mantiene 206 SECURITY DEFINER, 145 funciones con ejecución authenticated, 35 con evidencia parcial y 110 con revisión individual pendiente.
El plan maestro mantiene 325 controles: 10 aprobados, 102 en progreso y 213 pendientes. V159 agrega evidencia concreta, pero no cambia artificialmente la clasificación de controles.

**Dictamen:** ocho recorridos reales reversibles de conciliación institucional aprobados; certificación física y concurrencia siguen abiertas.
