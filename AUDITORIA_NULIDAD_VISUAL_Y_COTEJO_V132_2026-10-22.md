# SACRAMENTUM · AUDITORÍA VISUAL Y COTEJO DOCUMENTAL V131–V132

## Hallazgo y corrección
La interfaz de nulidad podía pedir una copia judicial, pero la API de revisión anterior no exigía comprobar su huella.
Supabase V132 deshabilita y revoca la firma de cuatro parámetros de revisión de Diócesis y crea una firma de cinco parámetros que requiere p_verified_sha256 igual al hash de la solicitud antes de autorizar.
El rechazo motivado permanece posible sin un archivo coincidente. El registro de auditoría identifica correspondencia del digest.
La comparación de huellas sólo prueba igualdad de bytes, NO autenticidad jurídica ni competencia del tribunal.

## Navegador Chrome con componente React verdadero y datos ficticios
AUDITORIA_REACT_BROWSER_NULIDAD_V131.json: 8/8 comprobaciones en Vite local sin Supabase real.
Cancillería y Diócesis en móvil y escritorio, roles Parroquia/Admin General excluidos, sin desbordamiento ni errores de ejecución.
La autorización empieza deshabilitada; copia con hash distinto bloqueada; copia con SHA coincidente habilita revisión; una ejecución ficticia de Cancillería requiere clic.
Las capturas están en AUDITORIA_EVIDENCIA_VISUAL_V131. No se cargaron expedientes originales ni claves.

## Prueba de funciones SQL en Supabase
scripts/qa-rollback-nullity-dual-authorization-v128.sql: ahora 13 rechazos incluyendo firma vieja y hash incorrecto, una revisión válida y exactamente un decreto/nota ficticios. ROLLBACK.
La inspección por roles y diócesis de V130 sigue vigente. Cero autorizaciones, matrimonios o decretos ficticios persistidos.
Migración V132 registrada con versión 20261022153516.

## Puerta de calidad
AUDITORIA_PUERTA_CALIDAD_V132.json: 608 pruebas sintéticas aprobadas, 28/28 verificaciones estrictas, build y CSS críticos correctos, npm audit total y runtime cero hallazgos.
Inventario AUDITORIA_RPC_PRIVILEGIADAS_V132.json: 136 SECDEF ejecutables por authenticated, 10 con pruebas parciales y 126 pendientes de auditoría individual.

## Limitaciones
El navegador utilizó los archivos reales de React/CSS pero autenticación y Supabase deliberadamente simulados; NO prueba sesión real de Cancillería o Diócesis.
No se ha realizado un nuevo despliegue ni se han emitido decretos reales. La custodia física de sentencias e integridad del origen siguen necesitando verificación humana.
El plan maestro queda en {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}. No se declaran aprobados controles generales por estas pruebas específicas.

Dictamen: brecha de autorización subsanada en backend, interacción visual verificada y trabajo reproducible.
