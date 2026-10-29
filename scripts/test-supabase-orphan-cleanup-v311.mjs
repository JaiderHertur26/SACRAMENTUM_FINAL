import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const text=(name)=>fs.readFileSync(name,'utf8');
const importCleanup=text('supabase/deployment/v311_integrity_orphan_links_cleanup.sql');
const chatCleanup=text('supabase/deployment/v311b_orphan_empty_QA_chat_rooms.sql');

test('V311 conserva antes de borrar 611 copias completas, privadas y recuperables',()=>{
 assert.match(importCleanup,/CREATE TABLE IF NOT EXISTS sacramentum_ledger\.orphan_cleanup_archive_v311/);
 assert.match(importCleanup,/REVOKE ALL ON sacramentum_ledger\.orphan_cleanup_archive_v311 FROM PUBLIC, anon, authenticated/);
 assert.match(importCleanup,/bad_ownership<>219 OR bad_links<>219 OR bad_import_rows<>173/);
 assert.match(importCleanup,/archived<>611/);
 assert.match(importCleanup,/ROLLBACK integral/);
});
test('V311 solo borra enlaces polimórficos rotos de Bautismo y Confirmación',()=>{
 assert.match(importCleanup,/DELETE FROM public\.legacy_import_ownership/);
 assert.match(importCleanup,/DELETE FROM public\.legacy_record_links/);
 assert.match(importCleanup,/NOT EXISTS\(SELECT 1 FROM public\.baptisms/);
 assert.match(importCleanup,/NOT EXISTS\(SELECT 1 FROM public\.confirmations/);
 assert.doesNotMatch(importCleanup,/DELETE FROM public\.(baptisms|confirmations|marriages|decretos|registry_audit_log|registry_print_events)/i);
 assert.doesNotMatch(importCleanup,/DROP TABLE|TRUNCATE TABLE/i);
});
test('V311 conserva documento de importación, retira target_id y envía a revisión',()=>{
 assert.match(importCleanup,/UPDATE public\.legacy_import_rows/);
 assert.match(importCleanup,/status='review',/);
 assert.match(importCleanup,/target_id=NULL/);
 assert.match(importCleanup,/issue_codes=array_append/);
 assert.match(importCleanup,/MISSING_TARGET_V311/);
 assert.match(importCleanup,/previousTargetId/);
 assert.doesNotMatch(importCleanup,/DELETE FROM public\.legacy_import_rows/i);
});
test('V311B remueve solo salas QA208 verdaderamente vacías y recuperables',()=>{
 assert.match(chatCleanup,/d\.name LIKE 'QA208-%'/);
 assert.match(chatCleanup,/NOT EXISTS \(SELECT 1 FROM public\.chat_room_members/);
 assert.match(chatCleanup,/NOT EXISTS \(SELECT 1 FROM public\.chat_messages/);
 assert.match(chatCleanup,/source_table='chat_rooms'/);
 assert.match(chatCleanup,/deleted_n<>2/);
 assert.doesNotMatch(chatCleanup,/DELETE FROM public\.chat_messages|DELETE FROM public\.chat_room_members|DROP TABLE/i);
});
