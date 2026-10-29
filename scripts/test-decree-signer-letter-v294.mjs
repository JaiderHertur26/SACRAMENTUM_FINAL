import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDecreeDocumentHtml} from '../src/services/decreeDocumentHtml.js';

const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const sql=read('supabase/migrations/20261029041812_sacramentum_v294_decree_signer_role_name_and_audit.sql');
const service=read('src/services/issueDecreeFromFullFormV287.js');
const chooser=read('src/components/chancery/DecreeSignerPickerV294.jsx');
const printer=read('src/services/decreeDocumentHtml.js');

test('V294 elección se hace antes de expedir por servicio compartido',()=>{
  assert.match(service,/chooseDecreeSignerV294\(\)/);
  assert.match(service,/if\(!signerOffice\)throw/);
  assert.match(service,/issue_chancery_form_decree_v294/);
  assert.match(service,/p_signer_office:signerOffice/);
  assert.match(chooser,/Canciller/);
  assert.match(chooser,/Vicecanciller/);
  assert.match(chooser,/list_chancery_decree_signers_v294/);
  assert.doesNotMatch(chooser,/input[^>]+name="signer_name"/);
});
test('V294 firma sale del directorio institucional y se registra transaccionalmente',()=>{
  assert.match(sql,/up\.role='chancery'/);
  assert.match(sql,/up\.auth_user_id=auth\.uid\(\)/);
  assert.match(sql,/chancellor_name/);
  assert.match(sql,/vice_chancellor_name/);
  assert.match(sql,/p_signer_office NOT IN \('canciller','vice_canciller'\)/);
  assert.match(sql,/public\.issue_chancery_form_decree_v287\(/);
  assert.match(sql,/UPDATE public\.decretos SET payload/);
  assert.match(sql,/record_decree_signer_v294/);
  assert.match(sql,/decreeDocumentCode','CAL-ODC-022/);
  assert.match(sql,/decreeDocumentVersion','002/);
  assert.match(sql,/REVOKE ALL ON FUNCTION/);
  assert.match(sql,/FROM PUBLIC,anon/);
});
test('V294 la identidad del firmante se conserva al imprimir archivo y destinatario',()=>{
  assert.match(printer,/payload\.issuingSigner\?\.name/);
  assert.match(printer,/payload\.issuingSigner\?\.office==='vice_canciller'/);
  assert.match(printer,/daFe:signer, da_fe:signer, dafe:signer/);
  assert.match(printer,/DA FE:/);
});
test('V294 formato carta compacto con código y versión solicitados, sin sello de revisión',()=>{
  assert.match(printer,/@page\{size:Letter;margin:7mm 10mm 7mm\}/);
  assert.match(printer,/min-height:0/);
  assert.match(printer,/sheet\.style\.zoom/);
  assert.match(printer,/CAL-ODC-022/);
  assert.match(printer,/const version = '002'/);
  assert.doesNotMatch(printer,/COPIA DE REVISIÓN/);
  assert.doesNotMatch(printer,/testDocumentPrintCss\(\)/);
});
test('V294 vistas alternativas también presentan el nombre y código actualizado',()=>{
  for(const p of [
    'src/components/PrintCorrectionDecree.jsx',
    'src/components/PrintCorrectionDecreeConfirmations.jsx',
    'src/components/PrintRepositionDecree.jsx'
  ]){
    const s=read(p);
    assert.match(s,/CAL-ODC-022<br\/>VERSIÓN: 002/);
    assert.match(s,/issuingSigner\?\.name/);
    assert.match(s,/daFe: cancillerName/);
    assert.doesNotMatch(s,/CAL-ODC-021|VERSIÓN: 001/);
  }
});
test('V294 DA FE muestra nombre y no código 0006 en el HTML',()=>{
  const html=buildDecreeDocumentHtml({
    row:{tipo:'correccion',sacrament_type:'bautismo',decree_number:'DECRETO 001',decree_date:'2026-10-28',
      payload:{recordOrigin:'chancery_pending_seat_v280',seatStatus:'awaiting_parish',
        issuingSigner:{office:'vice_canciller',name:'PBRO. JULIAN MOGOLLÓN MOGOLLÓN'},
        recordData:{nombres:'THALIA',apellidos:'JAQUIN',daFe:'0006',fechaSacramento:'2024-11-29'},
        originalPartidaSummary:{book:'0001',page:'0422',entry:'0844'},
        newPartidaSummary:{book:null,page:null,entry:null}}},
    institution:{dioceseName:'ARQUIDIÓCESIS DE BARRANQUILLA',
      chancellorName:'PBRO. DAGOBERTO RHENALS',viceChancellorName:'PBRO. JULIAN MOGOLLÓN MOGOLLÓN'},
    parish:{name:'PARROQUIA SANTA CRUZ'}
  });
  const daFe=html.match(/<div class="detail-label">DA FE:<\/div><div class="detail-value">([^<]+)<\/div>/);
  assert.ok(daFe,'DA FE row exists');
  assert.equal(daFe[1],'PBRO. JULIAN MOGOLLÓN MOGOLLÓN');
  assert.match(html,/VICECANCILLER ARQUIDIOCESANO/);
  assert.match(html,/CÓDIGO: CAL-ODC-022/);
  assert.match(html,/VERSIÓN: 002/);
  assert.doesNotMatch(html,/COPIA DE REVISIÓN/);
  assert.doesNotMatch(html,/>0006</);
});
