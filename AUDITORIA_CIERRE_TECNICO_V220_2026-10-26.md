# SACRAMENTUM FINAL — V220 · protección de documentos NO OFICIALES

**Fecha:** 26 de octubre de 2026. **Proyecto:** `C:\SACRAMENTUM\SACRAMENTUM_FINAL`.

## Premisa de trabajo

**TODOS los datos actualmente cargados son de prueba y NO son oficiales**, según confirmación explícita del responsable del proyecto. Aunque el usuario permita pruebas y modificaciones con datos ficticios, esta fase no borra registros históricos ni certifica libros como auténticos.

La V219 ya hacía visible esta situación en los paneles y pantalla de acceso. El riesgo restante era que **un documento impreso desde una ventana independiente o generado directamente como PDF no conservara ese aviso**.

## Protección documental V220

Se incorpora un sello persistente `DATOS DE PRUEBA - NO OFICIALES` y una leyenda `SIN VALIDEZ OFICIAL · ENTORNO DE PRUEBAS` en los principales formatos:

- **Impresión dentro de la aplicación:** `src/main.jsx` marca la raíz HTML según el modo del entorno y `src/index.css` inserta marca visible en el centro y advertencia superior al imprimir.
- **Ventanas independientes HTML:** decretos documentales, correcciones y reposiciones, expedientes matrimoniales de cuatro hojas, partidas y constancias de Exequias y plantillas documentales. Cada HTML autónomo incluye su propio CSS de advertencia; no depende de que la ventana tenga los estilos React.
- **Archivos PDF construidos con jsPDF:** libros, índices alfabéticos, estadísticas sacramentales diocesanas y reportes de Curia/parroquia. El helper `stampTestPdfPages()` estampa **cada página del PDF**, conserva la página activa y añade una advertencia de invalidez oficial al pie.
- **Mantenimiento:** toda la lógica compartida en `src/utils/testDocumentStamp.mjs` y explícitamente activada por defecto. El valor `VITE_REGISTRY_DATA_MODE='official'` solo puede desactivar el aviso tras una configuración deliberada del entorno; **NO certifica los datos como oficiales por sí solo**.

## Evidencias comprobadas

- `scripts/test-test-document-watermarks-v220.mjs`: **15/15** ensayos específicos que instancian realmente los generadores HTML y jsPDF. Se validan etiquetas de prueba en seis tipos de HTML, cuatro tipos PDF y dos páginas del mismo documento.
- Se verifica el documento PDF generado internamente en cada página, no solo la existencia de estilos en el código.
- **1907/1907** pruebas generales aprobadas.
- **30/30** verificaciones de la puerta de calidad general, compilación Vite y controles de dependencias sin fallos.
- **Cero migraciones** y **cero modificaciones** de registros existentes en Supabase para esta versión. Toda la protección se sitúa en el frontend y la generación documental.

## Limitaciones honestas

Las comprobaciones actuales no sustituyen la inspección física de impresoras ni garantizan cobertura de cualquier medio de exportación ajeno a las rutas enumeradas. La emisión real exige una futura auditoría completa de fidelidad documental y permisos de expedición. El sistema sigue siendo un **entorno de prueba**.

Las 219 referencias históricas de la V219 continúan siendo 46 candidatos técnicamente coincidentes por cotejar, 1 conflicto de identidad bloqueado y 172 sin partida física coincidente. No se han reatribuido.

## Próximo bloque

Certificar todas las plantillas restantes con inspección de impresión real y, de manera paralela, preparar el protocolo de transición a entorno oficial: autorización expresa, copias de seguridad, aislamiento de datos ficticios, auditoría de roles y matriz final de Cancillería.

## Avance global

**89 % estimado**, resultado técnico ponderado **88.98 %**, sin representar una garantía de funcionamiento total.

| Área | Peso | Avance estimado |
|---|---:|---:|
| Infraestructura, CI y despliegue | 10 % | 97 % |
| Roles, jerarquía y separación institucional | 10 % | 94 % |
| Registros y pendientes de cuatro sacramentos | 20 % | 91 % |
| Cancillería, decretos y trazabilidad jurídica | 15 % | 90 % |
| Migración histórica e integridad de procedencia | 15 % | 90 % |
| Notas marginales y reconciliación | 10 % | 91 % |
| Reportes, chat y notificaciones | 8 % | 80 % |
| Documentos, constancias e impresión | 7 % | 84 % |
| Aceptación E2E y operaciones reales | 5 % | 66 % |

**Evidencias:** `AUDITORIA_DOCUMENTOS_PRUEBA_V220.json`, `AUDITORIA_AVANCE_GLOBAL_V220.json`, `AUDITORIA_PUERTA_CALIDAD_V220.json` y pruebas registradas en CI.
