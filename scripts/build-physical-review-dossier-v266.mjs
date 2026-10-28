// V266 · Deterministic anonymized reconciliation dossier, no edits to official rows.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source='AUDITORIA_LIBROS_HISTORICOS_V266_2026-10-28.json';
const inventory=JSON.parse(fs.readFileSync(source,'utf8'));
const rows=inventory.rows;
assert.equal(inventory.scopes,22,'Historical scope count changed; capture a fresh verified inventory');
assert.equal(inventory.records,8393,'Historical record total changed; capture a fresh verified inventory');
assert.equal(rows.length,22);
assert.equal(rows.reduce((a,v)=>a+v.records,0),8393);
assert.ok(rows.every(r=>/^[0-9a-f]{32}$/.test(r.digest)));
assert.ok(rows.every(r=>r.duplicate_positions===0));
const irregular=r=>r.internal_gaps>0||r.transitions>0||r.skipped_folios>0;
const anomalies=rows.filter(irregular);
const regular=rows.filter(r=>!irregular(r));
assert.equal(anomalies.length,11,'Investigate the historical categories, do not change flags silently');
const csvColumns=['parish_key','sacrament','book_type','book','records','folios',
 'min_folio','max_folio','internal_gaps','transitions','resets','skipped_folios',
 'duplicate_positions','max_on_folio','folios_over_two','digest','classification'];
const classification=r=>irregular(r)?'DISCONTINUIDAD_DIGITAL_COTEJO_FISICO_OBLIGATORIO':
 'PATRON_DIGITAL_REGULAR_COTEJO_FISICO_PENDIENTE';
const csv=[csvColumns.join(','),...rows.map(row=>csvColumns.map(col=>
 JSON.stringify(col==='classification'?classification(row):row[col]??'')).join(','))].join('\n')+'\n';
fs.writeFileSync('AUDITORIA_LIBROS_HISTORICOS_V266_2026-10-28.csv',csv);
const lines=[
 '# SACRAMENTUM FINAL · V266 · Expediente de conciliación histórica de libros',
 '',
 '**28 de octubre de 2026 · Evidencia de consulta SQL SOLO LECTURA. No es conciliación oficial.**',
 '',
 `Se analizaron **${inventory.records.toLocaleString('es-CO')} partidas** en **${inventory.scopes} ámbitos** (parroquia, sacramento, tipo y libro): **${anomalies.length} ámbitos con discontinuidad digital** y **${regular.length} con patrón digital regular pendiente de cotejo físico**.`,
 'No se encontraron coordenadas repetidas dentro de un mismo ámbito. Las 11 discontinuidades no pueden declararse legítimas por software. No se modificó ningún dato.',
 '',
 '## Ámbitos que requieren cotejo específico',
 '',
 '| Parroquia (clave anónima) | Sacramento | Libro | Partidas | Folios | Cortes entre folios | Reinicios/descensos | Máximo por folio | Última posición registrada |',
 '|---|---|---:|---:|---:|---:|---:|---:|---|',
 ...anomalies.map(r=>`| ${r.parish_key} | ${r.sacrament} | ${r.book} | ${r.records} | ${r.folios} | ${r.transitions} | ${r.resets} | ${r.max_on_folio} | ${r.last_three[0].folio} / ${r.last_three[0].number} |`),
 '',
 '## Interpretación responsable',
 '',
 '- **Discontinuidad digital** significa que entre dos posiciones consecutivas observadas hay salto, reinicio, caída de número o salto de folio. No demuestra por sí solo error de la partida: pueden existir folios no transcritos, encuadernación especial o anotaciones de época.',
 '- Algunos libros contienen **más de dos partidas por folio**; aplicar a toda la historia una capacidad fija 1–2 sería incorrecto. El formato permitido para los asientos nuevos debe fijarse con evidencia física, sin reordenar la historia.',
 '- **Patrón digital regular** no significa libro conciliado: puede faltar información en el libro físico que la base digital desconoce.',
 '- La clave anónima distingue parroquias para el informe sin divulgar sus identificadores internos. El personal autorizado debe cotejar la clave mediante la consulta SQL original.',
 '- La huella MD5 por ámbito fija la combinación de UUID internos y coordenadas ordenadas; sirve para detectar alteraciones en el conjunto observado, no constituye firma digital ni sustituto del libro físico.',
 '',
 '## Ficha obligatoria para aprobar cada ámbito',
 '',
 '1. Identificar parroquia, sacramento, tipo y código exacto del libro original. Cotejar los folios y todas las excepciones digitales contra el tomo físico o reproducción institucional.',
 '2. Adjuntar referencia de soporte (acta, inventario, folios/fotografías autorizadas) y dejar constancia de las excepciones documentadas, nunca modificar la historia para hacer cuadrar el algoritmo.',
 '3. Registrar la **última coordenada física válida** y las coordenadas iniciales que corresponde asignar al siguiente asiento (Libro, Folio, Número), el número de partidas permitidas por folio y si el número reinicia. Estos valores deben ser tomados del libro, no inferidos de max() digital.',
 '4. Firmar por funcionario parroquial autorizado y someter a cotejo independiente de Cancillería/Diócesis. Las dos firmas deben referirse al mismo inventario y a la misma documentación. Si el digest o conteos cambian, invalidar el cotejo y repetirlo.',
 '5. Solo después habilitar la memoria correspondiente en el nuevo motor V252. Un documento pendiente de firma no puede marcarse `legacy_reconciled=true`.',
 '',
 '## Resultado operacional',
 '',
 'V266 no ha creado ni aprobado memorias reales. Quedan **22 expedientes físicos por acreditar**, de los cuales 11 requieren investigación especial. El SQL y JSON/CSV permiten reconstruir y comprobar este diagnóstico sin consultar datos personales.',
 ''
];
fs.writeFileSync('AUDITORIA_COTEJO_LIBROS_V266_2026-10-28.md',lines.join('\n'));
console.log(JSON.stringify({total:rows.length,partidas:inventory.records,anomalos:anomalies.length,
   regulares:regular.length,mas_dos_por_folio:rows.filter(x=>x.folios_over_two>0).length}));
