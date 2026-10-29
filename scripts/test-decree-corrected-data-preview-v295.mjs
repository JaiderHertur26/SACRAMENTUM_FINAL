import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDecreeDocumentHtml} from '../src/services/decreeDocumentHtml.js';

const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const decree={
  id:'f5119c0a-1419-477f-a1ad-75c8abecc55c',
  tipo:'correccion',sacrament_type:'bautismo',decree_number:'Decreto 002',decree_date:'2026-10-27',
  payload:{
    recordOrigin:'chancery_pending_seat_v280',seatStatus:'awaiting_parish',
    targetName:'THIAGO JUNIOR SIERRA REYES',
    originalPartidaSummary:{book:'0001',page:'0429',entry:'0858'},
    newPartidaDraft:{
      nombres:'THIAGO JOSÉ',apellidos:'SIERRA REYES',
      fechaSacramento:'2024-12-13',fechaNacimiento:'2014-10-16',
      nombrePadre:'JERSON SIERRA KALIL',nombreMadre:'YESENIA ESTHER REYES OTERO',
      lugarNacimiento:'BARRANQUILLA, ATLÁNTICO - COLOMBIA',
      ministro:'JAIDER HERRERA TURIZO',sexo:'MASCULINO',
      tipoUnionPadres:'UNIÓN LIBRE',padrinos:'INDRID TERAN LOPEZ',
      abuelosPaternos:'JABID SIERRA MARTINEZ',
      abuelosMaternos:'LUIS REYES YEPES'
    },
    draftDetails:{originalPartida:{nombres:'THIAGO JUNIOR',apellidos:'SIERRA REYES'}},
    issuingSigner:{office:'vice_canciller',name:'PBRO. JULIAN MOGOLLÓN MOGOLLÓN'},
    reason:'SE LE CAMBIÓ EL SEGUNDO NOMBRE'
  }
};
const base={
 row:decree,
 parish:{name:'PARROQUIA MARÍA AUXILIO DE LOS CRISTIANOS',city:'BARRANQUILLA'},
 institution:{dioceseName:'ARQUIDIÓCESIS DE BARRANQUILLA',chancellorName:'PBRO. DAGOBERTO RHENALS'}
};
const detail=(html,label)=>{
 const x=html.match(new RegExp('<div class="detail-label">'+label+':<\\/div><div class="detail-value">([^<]+)<\\/div>'));
 return x?.[1]||'';
};
test('V295 decreto 002 muestra nombre corregido en encabezado y detalles, no antiguo',()=>{
 const html=buildDecreeDocumentHtml({...base,sacramentalRecord:{nombres:'THIAGO JUNIOR',apellidos:'SIERRA REYES'}});
 assert.match(html,/THIAGO JOSÉ SIERRA REYES/);
 assert.equal(detail(html,'NOMBRES'),'THIAGO JOSÉ');
 assert.doesNotMatch(html,/THIAGO JUNIOR/);
 assert.equal(decree.payload.targetName,'THIAGO JUNIOR SIERRA REYES');
});
test('V295 todos los campos corregidos prevalecen sin modificar el original',()=>{
 const modified=structuredClone(decree);
 modified.payload.newPartidaDraft={
  ...modified.payload.newPartidaDraft,
  apellidos:'REYES PÉREZ', fechaNacimiento:'2014-09-01',
  nombrePadre:'PADRE RECTIFICADO',nombreMadre:'MADRE RECTIFICADA',
  lugarNacimiento:'LUGAR RECTIFICADO',tipoUnionPadres:'CASADOS',
  sexo:'FEMENINO',ministro:'MINISTRO RECTIFICADO',
  padrinos:'PADRINOS RECTIFICADOS',
  abuelosPaternos:'ABUELOS RECTIFICADOS',
  abuelosMaternos:'ABUELAS RECTIFICADAS'
 };
 const previous={nombres:'THIAGO JUNIOR',apellidos:'SIERRA REYES',
   fechaNacimiento:'2014-10-16',nombrePadre:'PADRE ANTIGUO',
   nombreMadre:'MADRE ANTIGUA',sexo:'MASCULINO',
   padrinos:'PADRINOS ANTIGUOS'};
 const html=buildDecreeDocumentHtml({...base,row:modified,sacramentalRecord:{...previous,raw_data:{...previous}}});
 for(const expected of ['REYES PÉREZ','2014-09-01','PADRE RECTIFICADO','MADRE RECTIFICADA',
 'LUGAR RECTIFICADO','CASADOS','FEMENINO','MINISTRO RECTIFICADO',
 'PADRINOS RECTIFICADOS','ABUELOS RECTIFICADOS','ABUELAS RECTIFICADAS']){
   assert.ok(html.includes(expected),'Campo rectificado no visible '+expected);
 }
 assert.equal(detail(html,'APELLIDOS'),'REYES PÉREZ');
 assert.equal(detail(html,'PADRE'),'PADRE RECTIFICADO');
 assert.equal(detail(html,'MADRE'),'MADRE RECTIFICADA');
 assert.deepEqual(modified.payload.draftDetails.originalPartida,{nombres:'THIAGO JUNIOR',apellidos:'SIERRA REYES'});
});
test('V295 sin sello y firma centrada, sin perder código del decreto',()=>{
 const html=buildDecreeDocumentHtml(base);
 assert.doesNotMatch(html,/SELLO<br>CANCILLERÍA|class="seal"/);
 assert.match(html,/signature-row\{display:flex/);
 assert.match(html,/justify-content:center/);
 assert.match(html,/CAL-ODC-022/);
 assert.match(html,/VERSIÓN: 002/);
 assert.match(html,/PBRO. JULIAN MOGOLLÓN MOGOLLÓN/);
});
test('V295 preview usa exactamente el mismo documento sin activar impresión',()=>{
 const html=buildDecreeDocumentHtml({...base,autoPrint:false});
 assert.match(html,/THIAGO JOSÉ/);
 assert.doesNotMatch(html,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(\(\)=>window.print\(\)\)\)/);
 const page=read('src/pages/parish/ParishDecreeDetailPage.jsx');
 assert.match(page,/ParishDecreeSeatPanelV280/);
 assert.match(page,/srcDoc=\{previewHtml\}/);
 assert.match(page,/autoPrint: false/);
 assert.match(page,/autoPrint: true/);
 assert.match(page,/sandbox=""/);
 assert.doesNotMatch(page,/Datos adicionales del expediente/);
 assert.doesNotMatch(page,/Información del decreto/);
 assert.doesNotMatch(page,/Evidencia incorporada al expediente/);
});
test('V295 todas las plantillas alternativas carecen de sello y centran la firma',()=>{
 for(const file of ['PrintCorrectionDecree.jsx','PrintCorrectionDecreeConfirmations.jsx','PrintRepositionDecree.jsx']){
  const source=read('src/components/'+file);
  assert.doesNotMatch(source,/Sello<br\/>Cancillería/);
  assert.match(source,/flex justify-center items-end/);
 }
});
