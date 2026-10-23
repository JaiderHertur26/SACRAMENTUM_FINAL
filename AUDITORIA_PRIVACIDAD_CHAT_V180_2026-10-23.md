# SACRAMENTUM FINAL · V180 — Chat y notificaciones sin acceso de perfiles indefinidos

Fecha: 23 de octubre de 2026. Carpeta: C:\SACRAMENTUM\SACRAMENTUM_FINAL.

## Exposición real comprobada
En PostgreSQL una cuenta parroquial ficticia con status NULL e is_active=true, a la que current_app_role() ya negaba rol, ejecutó list_chat_directory() y recibió un directorio de tres entradas institucionales. La evidencia conservada sólo indica la cantidad: no se exportaron nombres, correos ni perfiles privados. Toda la cuenta fue revertida con BEGIN/ROLLBACK.

## Alcance de la corrección
Las diez funciones SECURITY DEFINER enumeradas en AUDITORIA_CHAT_NOTIFICACIONES_V180.json exigen explícitamente is_active IS TRUE y upper(status)=ACTIVE, preservando los demás filtros existentes de rol, jurisdicción, notas y vínculo matrimonial. Antes NULL status o NULL actividad eran interpretados como ACTIVE en diversos filtros. La migración verifica firmas y ocurrencia exacta de los dos patrones por RPC antes de redefinir; no altera tablas ni grants.

## Evidencia de QA real en transacción
Con una cuenta parroquial activa ficticia: 10/10 llamadas atravesaron sus puertas legítimas, incluidas lecturas del directorio y validaciones de negocio sin finalizar notificaciones reales.
Con seis estados incorrectos de ese mismo actor (NULL_STATUS, NULL_ACTIVE, SUSPENDED, DISABLED, PENDING, BLANK_STATUS): 60/60 comprobaciones resultaron en denegación institucional o listas de Chat vacías, según contrato. Se comprueban los mensajes esperados, no sólo la ausencia de excepciones.
Se confirma específicamente que el directorio contiene entradas para el actor legítimo, pero no se entrega ninguna a ese mismo actor después de perder el estado ACTIVE.

## Puerta de calidad y límites
31 contratos automatizados nuevos, 1.393/1.393 pruebas sintéticas, 28/28 controles estrictos, build Vite, CSS y dependencias aprobados.
Estas pruebas NO certifican autenticación real entre dos diócesis independientes, simultaneidad de dos conexiones PostgreSQL o todo el recorrido E2E de chat y notificaciones.
La auditoría maestra continúa con 325 controles, de los cuales 10 aprobados, 117 en progreso y 198 pendientes.

Para cerrar la publicación debe instalarse la migración oficial Supabase, repetirse la matriz SQL y regresiones de chat/notificaciones, sincronizar el timestamp en GitHub y confirmar CI y Vercel.
