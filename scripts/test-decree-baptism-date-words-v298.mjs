import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecreeDocumentHtml } from '../src/services/decreeDocumentHtml.js';
import { BARRANQUILLA_DIOCESE_ID } from '../src/lib/institutionalBranding.js';

const row = {
  diocese_id: BARRANQUILLA_DIOCESE_ID,
  tipo: 'correccion', sacrament_type: 'bautismo',
  decree_number: 'DECRETO 002', decree_date: '2026-10-27',
  payload: {
    targetName: 'THIAGO JUNIOR SIERRA REYES',
    newPartidaDraft: {
      nombres: 'THIAGO JOSÉ', apellidos: 'SIERRA REYES',
      fechaSacramento: '2024-12-13', fechaNacimiento: '2014-10-16',
      nombrePadre: 'JERSON SIERRA KALIL'
    },
    issuingSigner: { office: 'vice_canciller', name: 'PBRO. JULIÁN MOGOLLÓN MOGOLLÓN' }
  }
};
const document = (r) => buildDecreeDocumentHtml({
  row: r, institution: { dioceseName: 'ARQUIDIÓCESIS DE BARRANQUILLA' },
  parish: { name: 'PARROQUIA SANTA CRUZ' }, autoPrint: false
});
const detail = (html, label) => {
  const match = html.match(new RegExp('<div class="detail-label">' + label + ':<\\/div><div class="detail-value">([^<]+)<\\/div>'));
  return match?.[1] || '';
};

test('V298 Decreto 002: fecha de Bautismo escrita completa en letras', () => {
  const html = document(row);
  assert.equal(detail(html, 'FECHA DE BAUTISMO'), 'EL TRECE DE DICIEMBRE DE DOS MIL VEINTICUATRO');
  assert.equal(detail(html, 'FECHA NACIMIENTO'), '2014-10-16');
  assert.equal(detail(html, 'NOMBRES'), 'THIAGO JOSÉ');
  assert.match(html, /class="archdiocese-crest"/);
  assert.match(html, /padding-top:21mm;break-inside:avoid/);
  assert.equal(row.payload.newPartidaDraft.fechaSacramento, '2024-12-13');
});

test('V298 Bautismo: fecha se convierte también en reposición y desde el registro original', () => {
  const alternate = structuredClone(row);
  alternate.tipo = 'reposicion';
  alternate.payload.newPartidaDraft.fechaSacramento = '2026-01-01';
  assert.equal(detail(document(alternate), 'FECHA DE BAUTISMO'), 'EL UNO DE ENERO DE DOS MIL VEINTISÉIS');
  delete alternate.payload.newPartidaDraft.fechaSacramento;
  alternate.payload.newPartidaDraft.celebration_date = '2025-03-31';
  assert.equal(detail(document(alternate), 'FECHA DE BAUTISMO'), 'EL TREINTA Y UNO DE MARZO DE DOS MIL VEINTICINCO');
});

test('V298 no convierte otras fechas ni sacramentos sin solicitud', () => {
  const confirmation = structuredClone(row);
  confirmation.sacrament_type = 'confirmacion';
  assert.equal(detail(document(confirmation), 'FECHA DE CONFIRMACIÓN'), '2024-12-13');
  assert.equal(detail(document(row), 'FECHA NACIMIENTO'), '2014-10-16');
});
