# SACRAMENTUM V272 · Concepto diocesano autorizado y sucesión de Libros Supletorios

**28 de octubre de 2026 · Desarrollo en rama, sin instalaciones ni escrituras en Supabase.**

## Integración funcional

1. Se conserva el catálogo único `public.conceptos_anulacion` que usa Cancillería. La interfaz ya permite registrar un concepto `porReposicion` para un sacramento particular. No se ha creado ninguno en los datos reales.
2. Diócesis dispone de la nueva pantalla `DiocesanSupplementaryConceptApprovalV272.jsx`, integrada en Supervisión de Decretos. Al aprobar un concepto **preexistente**, exige identidad diocesana activa, `source_kind=manual`, `tipo=porReposicion`, `enlibro=2`, `seinscribe=true`, alcance sacramental explícito y acta verificable. Guarda un `policy_snapshot` de los datos del concepto en una tabla privada protegida por RLS. La reautorización de otra política o referencia se rechaza; nunca se modifica silenciosamente la autorización.
3. La emisión de un decreto nuevo V271 por Cancillería ahora requiere esta autorización diocesana **vigente para la versión exacta** del concepto. Cambiar el texto, código, fuente, efectos o activar/desactivar el concepto invalida el permiso hasta nueva revisión. No basta insertar un concepto libremente en el catálogo.
4. Se creó `public.open_next_supplementary_book_v272`: únicamente la parroquia propietaria puede cerrar un libro supletorio con al menos una partida real y abrir el siguiente Libro/Folio/Número manualmente, con constancia de cierre y una **nueva** boleta certificada por su **propio** decreto de reposición vigente y aprobado por otro actor diocesano. Verifica el último asiento físico, versión CAS, ausencia de otro tomo supletorio abierto y prohibición de reutilizar códigos. La escritura del cierre, el siguiente libro y las dos acciones de auditoría ocurren en una sola transacción. Bloquea volver a asentar en el libro cerrado.
5. Se reutiliza el panel parroquial `LedgerSeatPanelV264.jsx` y la interfaz `NextOfficialBookV270.jsx` con un servicio `openNextSupplementaryBookV272` separado: no se mezclan libros ordinarios y supletorios. La nueva UI está detrás de la bandera de activación que permanece apagada.
6. El corte de permisos V267 comprueba y habilita las dos firmas nuevas V272 en la operación coordinada de inicio desde cero, después del respaldo y vaciado verificados V268. Ninguna función se otorga por separado.

## Evidencia de laboratorio

`scripts/ci-four-real-seat-rpcs-v263.sh` comprueba ahora dos decretos sucesivos para la misma parroquia (emisión Cancillería y segunda aprobación Diócesis), autorización previa del concepto, rechazo de aprobación por parroquia o Cancillería, prohibición de emisión sin concepto autorizado, bloqueo de apertura del nuevo Libro Supletorio antes del segundo decreto, cierre físico y apertura sucesora, conservación de la primera partida, asiento en el segundo libro, bloqueo de partida en el antiguo, CAS obsoleto, idempotencia antes de asiento y rechazo tras un cambio no aprobado de política del concepto.

`scripts/test-supplementary-succession-v272.mjs` incorpora 5 controles específicos. Se mantiene la auditoría integral y la compilación del proyecto. La ejecución de las pruebas no implica habilitar operaciones oficiales.

**Estado:** V272 integrada en la rama y lista para pruebas aisladas. La base Supabase actual conserva 8.393 partidas de prueba y dos decretos históricos; no se borran todavía. Para la apertura oficial se debe revisar la institucionalidad real de las cuentas, respaldar y restaurar en un entorno aislado, limpiar las 56 tablas de transacciones ficticias y hacer el corte conjunto.
