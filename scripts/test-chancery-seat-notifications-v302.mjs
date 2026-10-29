import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDecreeDocumentHtml } from '../src/services/decreeDocumentHtml.js';

const read = p => fs.readFileSync(p,'utf8');
const component=read('src/components/chancery/ChanceryDecreeSeatReceiptsV280.jsx');
const dash=read('src/pages/chancery/ChanceryDashboard.jsx');
const service=read('src/services/decreeSeatsV280.js');
const seat=read('supabase/migrations/20261029001740_sacramentum_v280_parish_seat_strict_order_and_chancery_receipt.sql');
const center=read('src/pages/chancery/SacramentalDecreesCenterPage.jsx');

const base={
  tipo:'correccion',sacrament_type:'bautismo',decree_number:'DECRETO 0002',decree_date:'2026-10-27',
  payload:{newPartidaDraft:{nombres:'THIAGO JOSÉ',apellidos:'SIERRA REYES',
    fechaSacramento:'2024-12-13',fechaNacimiento:'2014-10-16'}}
};
const render = row => buildDecreeDocumentHtml({row,autoPrint:false});
const field = (html,label) => html.match(new RegExp(
  '<div class="detail-label">'+label+':<\\/div><div class="detail-value">([^<]+)<\\/div>'
))?.[1];

test('V302 Bautismo: fechas de bautismo y nacimiento en letras sin alterar origen',()=>{
  const original=structuredClone(base);
  const html=render(original);
  assert.equal(field(html,'FECHA DE BAUTISMO'),'EL TRECE DE DICIEMBRE DE DOS MIL VEINTICUATRO');
  assert.equal(field(html,'FECHA NACIMIENTO'),'EL DIECISÉIS DE OCTUBRE DE DOS MIL CATORCE');
  assert.equal(original.payload.newPartidaDraft.fechaNacimiento,'2014-10-16');
  assert.match(html,/THIAGO JOSÉ/);
});

test('V302 nacimiento en letras en Confirmación y Exequias, con datos ISO intactos',()=>{
  for(const type of ['confirmacion','exequias']){
    const row=structuredClone(base);
    row.sacrament_type=type;
    const html=render(row);
    assert.equal(field(html,'FECHA NACIMIENTO'),'EL DIECISÉIS DE OCTUBRE DE DOS MIL CATORCE');
    assert.equal(row.payload.newPartidaDraft.fechaNacimiento,'2014-10-16');
  }
});
test('V302 el asiento y el acuse de Cancillería nacen en una única transacción de servidor',()=>{
  assert.match(seat,/UPDATE public\.decretos SET replacement_record_id=rec/);
  assert.match(seat,/UPDATE public\.official_notifications[\s\S]*status='processed'/);
  assert.match(seat,/INSERT INTO sacramentum_ledger\.chancery_decree_receipts_v280/);
  assert.match(seat,/chanceryNotified',true/);
  assert.match(seat,/notificationCompleted',true/);
  assert.match(service,/get_chancery_decree_receipts_v280/);
  assert.match(service,/mark_chancery_decree_receipt_read_v280/);
  assert.match(seat,/IF v_affected<>1 THEN RAISE EXCEPTION/);
});

test('V302 el panel se ubica en Inicio de Cancillería y deja limpio el Centro',()=>{
  assert.match(dash,/import ChanceryDecreeSeatReceiptsV280/);
  assert.match(dash,/<ChanceryDecreeSeatReceiptsV280\s*\/>/);
  assert.doesNotMatch(center,/<ChanceryDecreeSeatReceiptsV280/);
});

test('V302 aviso identifica decreto, parroquia, fecha, libro, folio, número y cierre',()=>{
  for(const text of ['Decretos asentados y completados','decreeNumber','parishName','seatedAt',
    'item.book','item.folio','item.number','Decreto completado','notificationPending',
    'Confirmar lectura','Recibido en Cancillería']) assert.ok(component.includes(text),text);
  assert.match(component,/\.from\('parishes'\)/);
  assert.match(component,/\.select\('id,name'\)/);
  assert.match(component,/listChanceryDecreeReceiptsV280\(\)/);
});

test('V302 aviso persiste y se reconsulta por intervalo, foco y regreso a la aplicación',()=>{
  assert.match(component,/REFRESH_MS = 30000/);
  assert.match(component,/setInterval\(onVisible, REFRESH_MS\)/);
  assert.match(component,/addEventListener\('visibilitychange'/);
  assert.match(component,/addEventListener\('focus'/);
  assert.match(component,/addEventListener\('online'/);
  assert.match(component,/clearInterval\(timer\)/);
  assert.match(component,/markChanceryDecreeReceiptReadV280\(row\.decreeId\)/);
  assert.match(component,/if \(!active\) return null/);
  assert.doesNotMatch(component,/supabase\.from\(['"]chancery_decree_receipts_v280['"]\)\.insert/);
});
