# SACRAMENTUM · DECRETOS POSTERIORES CONCURRENTES V137

## Ensayo SQL reversible
- Se crearon cuatro combinaciones Bautismo/Confirmación corrección/reposición con un segundo decreto activo, asociado a la misma supletoria sin modificar su status seated.
- El procedimiento anterior de reversión fue rechazado en las cuatro combinaciones. Decretos, notas y avisos permanecieron intactos.
- script: scripts/qa-rollback-later-active-decree-baptism-confirmation-v137.sql. Todos los casos ejecutados en BEGIN y ROLLBACK.
- La protección comprobada fue instalada con la migración V136, por lo que no hizo falta otra migración.

## Evidencia de calidad
- scripts/test-later-linked-decree-v137.mjs: cuatro nuevas comprobaciones contractuales incluidas en el gate y GitHub Actions.
- AUDITORIA_PUERTA_CALIDAD_V137.json: 679/679 sintéticas aprobadas y 28/28 verificaciones estrictas; npm audit completo/producción sin hallazgos, compilación y CSS aprobados.
- Consulta final: cero partidas Bautismo/Confirmación/decretos ficticios; ANULACION cinco pendientes y dos vinculados intactos.
- 136 funciones SECURITY DEFINER expuestas, 19 revisadas parcialmente, 117 pendientes. Evidencia añadida a 15 controles.
- Plan maestro: {"APROBADO":10,"EN_PROGRESO":102,"PENDIENTE":213}.

## Límites
- No se han probado transacciones concurrentes físicas multisesión ni la totalidad de un decreto judicial real.
- La interfaz autenticada, impresión y las funciones pendientes siguen fuera de este alcance. No se desplegó frontend.

Dictamen: bloqueo de segundo decreto activo comprobado con datos ficticios, rollback y ninguna persistencia.
