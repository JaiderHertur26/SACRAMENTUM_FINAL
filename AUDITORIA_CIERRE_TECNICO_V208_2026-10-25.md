# SACRAMENTUM FINAL — Cierre técnico V208
**Fecha de trabajo:** 25 de octubre de 2026 (Colombia; evidencias técnicas registradas el 26 de octubre UTC)

**Repositorio:** JaiderHertur26/SACRAMENTUM_FINAL

**Rama de implementación:** audit/v208-live-auth-and-closure

**Alcance:** autenticación institucional, recuperación de contraseña, navegación real de cuatro roles y control de seguridad en frontera.

## Cambios verificados
- Se evita que respuestas asincrónicas de perfiles reabran sesiones cerradas o sustituyan al usuario vigente. La devolución de eventos Auth al SDK ya no espera consultas internas.
- El cierre de sesión borra inmediatamente la proyección institucional y las credenciales locales, incluso ante falla de red.
- Se agregó ruta pública /reset-password y servicio que valida identidad real con GoTrue antes de cambiar la contraseña.
- Se corrigió el diagnóstico de Admin General para leer `isAuthenticated` como booleano y no llamarlo como función.
- Se mantiene el inventario histórico de 107 rutas protegidas/alias V175; se excluye de esa fotografía únicamente la ruta pública nueva y se protege con pruebas propias.
- Se integraron nuevas pruebas a la puerta de calidad y a GitHub Actions.

## Evidencia y alcance exactos
| Control | Resultado |
|---|---|
| Batería sintética V89–V208 | 1.618/1.618 |
| Puerta de calidad completa | 30/30, estricta |
| Build Vite | Aprobado |
| Dependencias auditadas | 0 hallazgos npm a esta fecha |
| Autenticación real GoTrue | 8 cuentas de ensayo válidas según AUDITORIA_AUTH_SESIONES_REALES_V208.json |
| Navegador real, rutas protegidas estáticas | 56/56, sin excepciones JS registradas tras la corrección |
| JWT y escalada de rol | Validaciones negativas reales en AUDITORIA_JWT_SERVIDOR_V208.json |
| Cambio de contraseña real | Cuenta de ensayo modificada y contraseña anterior rechazada |
| Aislamiento de jurisdicciones | Operaciones cruzadas denegadas en pruebas con JWT auténticos |
| Análisis de posibles secretos en cambios locales | 51 archivos inspeccionados, 0 patrones de credenciales sensibles detectados |

## Límites de la evidencia
1. No se ha certificado todavía la **entrega de correos**, apertura del vínculo recibido ni el intercambio completo del token de recuperación.
2. Las 56 rutas corresponden a rutas estáticas protegidas; no equivalen a todos los formularios, botones, rutas de detalle dinámicas y operaciones CRUD.
3. Las pruebas reales con cuentas ficticias no autorizan alterar partidas históricas ni datos pastorales; cualquier limpieza posterior de cuentas QA requiere identificación segura de esas cuentas.
4. La puerta local por sí sola no demuestra que el despliegue de producción haya recibido los cambios: confirmar por separado GitHub CI, merge y Vercel.

## Archivos clave
- AUDITORIA_PUERTA_CALIDAD_V208.json
- AUDITORIA_RUTAS_ESTATICAS_REALES_V208.json
- AUDITORIA_AUTH_APP_COMPLETA_V208.json
- AUDITORIA_AUTH_SESIONES_REALES_V208.json
- AUDITORIA_AUTH_JURISDICCIONES_V208.json
- AUDITORIA_JWT_SERVIDOR_V208.json
- AUDITORIA_RECUPERACION_PASSWORD_V208.json
- AUDITORIA_CONCURRENCIA_REAL_V208.json

**Próximo bloque V209:** enlaces de recuperación completos por correo en ambiente de prueba; navegación dinámica, ensayos de botones, CRUD y emisiones documentales con datos ficticios; comprobación posterior al despliegue y cierre de cuentas QA.
