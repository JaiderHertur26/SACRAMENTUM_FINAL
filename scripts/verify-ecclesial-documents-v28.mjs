import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [];
const ok = (label, condition) => {
  checks.push({ label, condition: Boolean(condition) });
  console.log(`${condition ? '✓' : '✗'} ${label}`);
};

const baptismTicket = read('src/components/BaptismTicket.jsx');
const confirmationTicket = read('src/components/ConfirmationTicket.jsx');
const marriageTicket = read('src/components/MatrimonioTicket.jsx');
const baptismPartida = read('src/components/BaptismPrintTemplate.jsx');
const confirmationPartida = read('src/components/ConfirmationPrintTemplate.jsx');
const marriagePartida = read('src/components/MatrimonioPrintTemplate.jsx');
const funeralPage = read('src/pages/parish/FuneralPartidasPage.jsx');
const funeralHtml = read('src/utils/funeralDocumentHtml.js');
const primitives = read('src/components/sacramental/EcclesialDocumentPrimitives.jsx');

for (const [name, source] of [
  ['Boleta Bautismo', baptismTicket],
  ['Boleta Confirmación', confirmationTicket],
  ['Boleta Matrimonio', marriageTicket]
]) {
  ok(`${name}: usa familia documental eclesial`, source.includes('EcclesialHeader') && source.includes('TicketFrame'));
  ok(`${name}: diferencia boleta de partida`, /no constituye partida|no sustituye una Partida/i.test(source));
  ok(`${name}: conserva copia archivo y copia familiar`, /ARCHIVO PARROQUIAL/.test(source) && /(COPIA PARA LA FAMILIA|COPIA PARA LOS CONTRAYENTES)/.test(source));
}

for (const [name, source] of [
  ['Partida Bautismo', baptismPartida],
  ['Partida Confirmación', confirmationPartida],
  ['Partida Matrimonio', marriagePartida]
]) {
  ok(`${name}: usa DocumentFrame eclesial`, source.includes('DocumentFrame') && source.includes('RegistryBand'));
  ok(`${name}: muestra Libro Folio Número`, /Libro/.test(source) && /Folio/.test(source) && /(Número|numero)/.test(source));
  ok(`${name}: incluye notas marginales`, source.includes('NotesBox'));
  ok(`${name}: incluye firma parroquial`, source.includes('SignatureLine'));
}

ok('Primitivas: doble borde eclesial', primitives.includes("rgba(184,149,50,.38)") && primitives.includes('EcclesialMark'));
ok('Primitivas: pie SACRAMENTUM', primitives.includes('SACRAMENTUM · REGISTRO ECLESIAL AUDITABLE'));
ok('Exequias: página usa generador eclesial', funeralPage.includes('buildFuneralPartidaHtml') && funeralPage.includes('buildFuneralConstanciaHtml'));
ok('Exequias: Partida y Constancia diferenciadas', funeralHtml.includes('Partida de Exequias') && funeralHtml.includes('Constancia de Exequias') && funeralHtml.includes('no sustituye la partida'));
ok('Exequias: doble borde y marca eclesial', funeralHtml.includes('sheet:after') && funeralHtml.includes('class="mark"'));

ok(
  'Partida Confirmación: no inventa lugar desde parroquia actual',
  !/lugarConfirmacion\s*=\s*clean\([^\n]*\|\|\s*parroquia\)/.test(confirmationPartida)
);
ok(
  'Partida Bautismo: no inventa lugar desde parroquia actual',
  !/lugarBautismo\s*=\s*clean\([^\n]*\|\|\s*parroquia\)/.test(baptismPartida)
);
ok(
  'Partida Matrimonio: no inventa lugar desde parroquia actual',
  !/const place\s*=\s*clean\([^\n]*\|\|\s*parroquia\)/.test(marriagePartida)
);

const failed = checks.filter((item) => !item.condition);
if (failed.length) {
  console.error(`\nSACRAMENTUM V28 · FALLÓ · ${failed.length}/${checks.length} controles con incidencia.`);
  process.exit(1);
}

console.log(`\nSACRAMENTUM V28 · OK · ${checks.length}/${checks.length} controles.`);
