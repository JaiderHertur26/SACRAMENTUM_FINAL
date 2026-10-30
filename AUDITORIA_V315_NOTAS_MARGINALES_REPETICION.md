# SACRAMENTUM V315 — Notas marginales de Decreto de Repetición

## Gobierno documental
La Cancillería expide el decreto y determina, partida por partida, si se conserva, queda sin efectos registrales o requiere investigación. La parroquia que custodia el libro es la única autorizada a ejecutar/constatar la nota de su partida. La Cancillería supervisa las constancias y registra la evidencia recibida de parroquias externas.

## Ejecución por partida
1. Si la disposición es `without_effect`, el párroco debe asentar una nota individual antes de cerrar su actuación.
2. Si existe una única partida digital con coincidencia exacta de parroquia/Libro/Folio/Número (y del ID vinculado, si se consignó), la nota se registra en `marginal_notes`, enlazada por `decree_id`, con impresión obligatoria, bloqueo de edición y datos de auditoría.
3. Si NO hay partida digital coincidente, el párroco certifica expresamente que asentó materialmente la nota en el libro físico. El sistema guarda evidencia y texto en el expediente, SIN inventar una partida digital ni una fila ficticia en `marginal_notes`.
4. Una partida ambigua o no coincidente bloquea la operación. Ninguna parroquia puede ejecutar una nota de otro territorio.
5. Cada asiento tiene una clave `entry-N`, una referencia documental, observación, fecha y usuario. Repetir la operación se rechaza. Un índice único evita notas digitales duplicadas del mismo decreto.
6. El cierre documental de V314 está reforzado en el servidor: todas las notas ordenadas a la parroquia deben estar asentadas/certificadas. Una constancia genérica no sustituye un asiento individual. Los destinos externos no se contabilizan como parroquias internas (corrige agrupación de NULL en PostgreSQL).

## Preservación y límites
- NO hay `DELETE` ni `UPDATE` sobre `baptisms`; se preservan las inscripciones y coordenadas originales.
- No se asignan memorias Libro/Folio/Número, ni se toca el mecanismo histórico.
- Las notas digitales pasan a la lectura e impresión sacramental mediante el servicio existente `listMarginalNotesForRecord`, con `print_policy=required`.
- La nota usa fórmula institucional fija y transcribe número/fecha del decreto y la eventual partida acreditativa. Las plantillas jurídicas generales se siguen gestionando en Cancillería. No se supone una segunda nulidad sin disposición expresa.
- Los actos exteriores a SACRAMENTUM se acreditan documentalmente en Cancillería, sin crear cuentas/parroquias ficticias.
- Las confirmaciones en libros físicos dependen de la declaración del custodio: el sistema no puede verificar físicamente un manuscrito.
- Se requieren pruebas finales de uso con sesiones reales de Cancillería y Parroquia; pruebas automatizadas estáticas no equivalen a auditoría notarial/canónica completa.
- La base contiene registros de PRUEBA: no autoriza entrada en operación oficial.

## Verificaciones 29/10/2026
- `node --test` V312+V313+V314+V315: 27/27.
- `npm run build` Vite: correcto.
- SQL validado antes en transacción revertida y migración `v315_repetition_marginal_execution` instalada.
- Permisos: `anon` no puede ejecutar el RPC, `authenticated` sí (más verificación de rol y parroquia dentro de la función).
- Conteos antes/después: bautismos 5040 / 5040, notas marginales 82 / 82, decretos de Repetición 0 / 0.
