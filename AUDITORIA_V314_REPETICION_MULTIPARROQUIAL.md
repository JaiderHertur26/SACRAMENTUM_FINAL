# SACRAMENTUM V314 — Decreto de Repetición con partidas múltiples

Fecha: 29 de octubre de 2026  
Rama: `feat/v314-repeticion-partidas-multiples`  
Base: V313 `90e27d5`.

## Identificación jurídica y registral

En la tabla `public.conceptos_anulacion` del proyecto REGISTRO SACRAMENTOS existe el concepto 001 «ERROR DE TRANSCRIPCION O REPETICION» (`porRepeticion`, `general`). Tiene `seinscribe=false`, `gennota=false`, `enlibro=0`. No constituye por sí solo mandato inequívoco de anular todas las inscripciones. El fundamento y la parte dispositiva del decreto deben determinar la suerte de cada partida.

El canon 845 §1 prohíbe reiterar el bautismo válido. El canon 869 admite casos de bautismo bajo condición tras investigación de una duda fundada. La conservación del dato histórico sacramental es independiente de su aptitud para certificar. Las disposiciones de anulación deben ser expresas y atribuidas a autoridad competente.

## Diferencia de expedientes

- **V312 documental**: interpretación de error de transcripción u otros antecedentes; una parroquia, una constancia, sin cambios registrales.
- **V314 por duplicidad de partidas bautismales**: dos a doce inscripciones relativas a un mismo interesado. Cada una identifica parroquia, libro, folio, número, opción individual `retain` / `without_effect` / `investigate` y fundamento.
- **Parroquias internas**: cada parroquia afectada recibe notificación del mismo decreto, acredita su actuación y puede solicitar aclaración. El expediente no termina hasta obtener todas las constancias.
- **Parroquias externas o todavía no operativas**: se conserva el nombre real, jurisdicción y ubicación del asiento; no se inventa identidad ni se entrega acceso al sistema. Cancillería registra la constancia externa efectivamente recibida.
- **Ámbito**: por seguridad, la nueva disposición múltiple solo está habilitada para Bautismo hasta estudiar las demás figuras. Se mantiene el mismo Centro de Decretos y el diseño de Corrección / Reposición.

## Protecciones

1. Las coordenadas originales no cambian. No hay `DELETE` ni `UPDATE public.baptisms` en el SQL V314.
2. Si se indica `recordId`, servidor comprueba su parroquia y coordenadas.
3. No se permite duplicar referencias (parroquia+libro+folio+número) en el mismo expediente.
4. Solo Cancillería activa de la diócesis puede expedir y registrar constancias externas.
5. Solo la parroquia involucrada puede registrar su constancia. Las demás parroquias, obispo o administrador no reciben acceso al archivo.
6. La función de consulta no cambia los permisos globales de `public.decretos`.
7. Cierre condicionado a todas las actuaciones internas y externas; transiciones bajo bloqueo de fila y auditoría.
8. Los efectos jurídicos deben ser decididos con el decreto firmado; no se aplica una anulación física ni una nota marginal automática.

## Pruebas locales

- 21 pruebas V312 + V313 + V314: aprobadas.
- `npm run build`: compilación aprobada de 3352 módulos.
- SQL V314 comprobado en el proyecto conectado bajo transacción `BEGIN; ... ROLLBACK;`, sin persistir cambios.
- No se emitieron decretos reales, no se borraron partidas y no se cambió la base oficial durante estas verificaciones.

## Integración pendiente de acto jurídico / validación de despliegue

La nueva versión requiere instalar el SQL V314 y desplegar el frontend integrado después de las pruebas de autorización con roles reales. Está diseñada para recopilar y tramitar la decisión, **no para sustituir una declaración de la autoridad ni ejecutar automáticamente la anotación final «sin efectos»**. Si el decreto auténtico ordena dejar sin efecto dos partidas, se requiere definir la fórmula marginal legal y su modo de ejecución auditado sobre cada asiento, conservando el original. No debe inferirse esta orden del mero nombre «Repetición».
