import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sql=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20261022004255_require_valid_nullity_notice_before_receipt_v106.sql'),'utf8');

test('Se limitan dos RPC institucionales existentes',()=>{
 assert.match(sql,/process_matrimonial_notification_recipient\(uuid\)/);
 assert.match(sql,/archive_matrimonial_notification_recipient\(uuid\)/);
});
test('No se crean ni alteran directamente partidas sacramentales',()=>{
 assert.doesNotMatch(sql,/^\s*(?:UPDATE\s+public\.|DELETE\s+FROM\s+public\.|INSERT\s+INTO\s+public\.|TRUNCATE)\b/im);
});
test('Rechaza documentos fuente cancelados o revertidos',()=>{
 assert.match(sql,/v_doc\.status,'sent'\)\) IN \('cancelled','reversed','revertida'\)/);
});
test('Aplica control reforzado solo a notificación de nulidad',()=>{
 assert.match(sql,/v_doc\.notification_type,'matrimonio'\)\)='nulidad_matrimonial'/);
});
test('No acepta sentencia sin UUID verificable ni Matrimonio',()=>{
 assert.match(sql,/v_doc\.marriage_id IS NULL/);
 assert.match(sql,/v_decree_raw !~\*/);
});
test('Destinatario debe coincidir con el Bautismo destinatario del documento',()=>{
 assert.match(sql,/v_doc\.source_baptism_id IS DISTINCT FROM v_row\.target_baptism_id/);
});
test('La sentencia debe existir, ser de nulidad y estar vigente',()=>{
 assert.match(sql,/FROM public\.decretos/);
 assert.match(sql,/v_decree\.tipo<>'nulidad_matrimonial'/);
 assert.match(sql,/v_decree\.sacrament_type<>'matrimonio'/);
 assert.match(sql,/NOT IN \('active','vigente'\)/);
});
test('El decreto pertenece al mismo matrimonio y parroquia emisora',()=>{
 assert.match(sql,/v_decree\.original_record_id IS DISTINCT FROM v_doc\.marriage_id/);
 assert.match(sql,/v_decree\.parish_id IS DISTINCT FROM v_doc\.sender_parish_id/);
});
test('Número del decreto coincide con el documento y el destinatario',()=>{
 assert.match(sql,/v_decree\.decree_number IS DISTINCT FROM \(v_doc\.payload->>'decreeNumber'\)/);
 assert.match(sql,/v_decree\.decree_number IS DISTINCT FROM \(v_row\.payload->>'decreeNumber'\)/);
});
test('El Bautismo consta explícitamente entre los IDs autorizados por la nulidad',()=>{
 assert.match(sql,/v_decree\.payload->'baptismIds'/);
 assert.match(sql,/@> jsonb_build_array\(v_row\.target_baptism_id::text\)/);
});
test('Vuelve a verificar identidad bautismal al recibir el aviso',()=>{
 assert.match(sql,/PERFORM private\.assert_nullity_baptism_link_v105/);
});
test('Una recepción procesada, con nota o acuse no se cancela',()=>{
 assert.match(sql,/v_row\.status,'pending'\)\)='processed'/);
 assert.match(sql,/coalesce\(v_row\.note_applied,false\)/);
 assert.match(sql,/v_row\.receipt_document_number IS NOT NULL/);
});
test('El archivado repetido de una notificación ya cancelada es idempotente',()=>{
 assert.match(sql,/IF lower\(coalesce\(v_row\.status,'pending'\)\)='cancelled' THEN/);
 assert.match(sql,/RETURN true;/);
});
test('La migración falla si deriva la implementación anterior',()=>{
 assert.match(sql,/IF strpos\(v_src,v_anchor\)=0/);
 assert.match(sql,/RAISE EXCEPTION 'V106:/);
});
