# SACRAMENTUM FINAL · V266 · Expediente de conciliación histórica de libros

**28 de octubre de 2026 · Evidencia de consulta SQL SOLO LECTURA. No es conciliación oficial.**

Se analizaron **8.393 partidas** en **22 ámbitos** (parroquia, sacramento, tipo y libro): **11 ámbitos con discontinuidad digital** y **11 con patrón digital regular pendiente de cotejo físico**.
No se encontraron coordenadas repetidas dentro de un mismo ámbito. Las 11 discontinuidades no pueden declararse legítimas por software. No se modificó ningún dato.

## Ámbitos que requieren cotejo específico

| Parroquia (clave anónima) | Sacramento | Libro | Partidas | Folios | Cortes entre folios | Reinicios/descensos | Máximo por folio | Última posición registrada |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 35e655bf8 | bautismo | 1 | 45 | 28 | 11 | 0 | 2 | 435 / 870 |
| 5716fb6d9 | bautismo | 1 | 752 | 375 | 8 | 5 | 4 | 377 / 753 |
| 867342ca6 | bautismo | 1 | 4 | 4 | 3 | 0 | 1 | 504 / 1007 |
| 867342ca6 | bautismo | 2 | 2 | 2 | 1 | 0 | 1 | 346 / 690 |
| 5716fb6d9 | bautismo | 3 | 1001 | 502 | 4 | 0 | 2 | 503 / 1006 |
| 5716fb6d9 | bautismo | 4 | 905 | 454 | 4 | 1 | 3 | 454 / 907 |
| 5716fb6d9 | bautismo | 6 | 1299 | 653 | 6 | 0 | 2 | 656 / 1311 |
| 5716fb6d9 | confirmacion | 1 | 1838 | 431 | 105 | 103 | 13 | 917 / 1834 |
| 5716fb6d9 | confirmacion | 2 | 248 | 125 | 18 | 15 | 3 | 229 / 248 |
| 5716fb6d9 | matrimonio | 1 | 963 | 481 | 27 | 14 | 4 | 620 / 1240 |
| 5716fb6d9 | matrimonio | 3 | 247 | 123 | 1 | 1 | 3 | 123 / 249 |

## Interpretación responsable

- **Discontinuidad digital** significa que entre dos posiciones consecutivas observadas hay salto, reinicio, caída de número o salto de folio. No demuestra por sí solo error de la partida: pueden existir folios no transcritos, encuadernación especial o anotaciones de época.
- Algunos libros contienen **más de dos partidas por folio**; aplicar a toda la historia una capacidad fija 1–2 sería incorrecto. El formato permitido para los asientos nuevos debe fijarse con evidencia física, sin reordenar la historia.
- **Patrón digital regular** no significa libro conciliado: puede faltar información en el libro físico que la base digital desconoce.
- La clave anónima distingue parroquias para el informe sin divulgar sus identificadores internos. El personal autorizado debe cotejar la clave mediante la consulta SQL original.
- La huella MD5 por ámbito fija la combinación de UUID internos y coordenadas ordenadas; sirve para detectar alteraciones en el conjunto observado, no constituye firma digital ni sustituto del libro físico.

## Ficha obligatoria para aprobar cada ámbito

1. Identificar parroquia, sacramento, tipo y código exacto del libro original. Cotejar los folios y todas las excepciones digitales contra el tomo físico o reproducción institucional.
2. Adjuntar referencia de soporte (acta, inventario, folios/fotografías autorizadas) y dejar constancia de las excepciones documentadas, nunca modificar la historia para hacer cuadrar el algoritmo.
3. Registrar la **última coordenada física válida** y las coordenadas iniciales que corresponde asignar al siguiente asiento (Libro, Folio, Número), el número de partidas permitidas por folio y si el número reinicia. Estos valores deben ser tomados del libro, no inferidos de max() digital.
4. Firmar por funcionario parroquial autorizado y someter a cotejo independiente de Cancillería/Diócesis. Las dos firmas deben referirse al mismo inventario y a la misma documentación. Si el digest o conteos cambian, invalidar el cotejo y repetirlo.
5. Solo después habilitar la memoria correspondiente en el nuevo motor V252. Un documento pendiente de firma no puede marcarse `legacy_reconciled=true`.

## Resultado operacional

V266 no ha creado ni aprobado memorias reales. Quedan **22 expedientes físicos por acreditar**, de los cuales 11 requieren investigación especial. El SQL y JSON/CSV permiten reconstruir y comprobar este diagnóstico sin consultar datos personales.
