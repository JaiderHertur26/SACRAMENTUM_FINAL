import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20261027165000_scope_void_document_before_lock_v246.sql','utf8');

test('V246 only proposes an audited patch to document void RPC',()=>{
 assert.match(migration,/to_regprocedure\('public\.void_document_issuance\(uuid,text\)'\)/);
 assert.match(migration,/pg_get_functiondef/);
 assert.match(migration,/audited jurisdiction ordering drift/);
 assert.match(migration,/v_hits <> 1/);
 assert.match(migration,/EXECUTE v_source/);
});
test('V246 scopes the record before row lock and suppresses cross-jurisdiction enumeration',()=>{
 const begin=migration.indexOf('  v_new text :=');
 const end=migration.indexOf('  v_hits integer;',begin);
 const proposed=migration.slice(begin,end);
 assert.ok(begin>=0&&end>begin);
 const queryPos=proposed.indexOf('where id=p_issuance_id');
 const scopeParish=proposed.indexOf("v_role=''parish'' and v_parish is not null and parish_id=v_parish");
 const scopeDiocese=proposed.indexOf("v_role in (''diocese'',''chancery'') and v_diocese is not null and diocese_id=v_diocese");
 const lockPos=proposed.indexOf("'  for update;'");
 const errorPos=proposed.indexOf("Documento no encontrado");
 assert.ok(queryPos>=0&&scopeParish>queryPos&&scopeDiocese>scopeParish&&lockPos>scopeDiocese&&errorPos>lockPos);
 assert.doesNotMatch(proposed,/Documento fuera de su jurisdicción/);
});
test('V246 does not add DML or expand allowed institutional roles',()=>{
 assert.doesNotMatch(migration,/^\s*(?:INSERT INTO|UPDATE\s+public\.|DELETE FROM|TRUNCATE\s+TABLE|DROP TABLE)\b/gmi);
 assert.doesNotMatch(migration,/v_role\s*=\s*'admin_general'/);
 assert.match(migration,/v_parish is not null/);
 assert.match(migration,/v_diocese is not null/);
});
test('V246 is not a claim that the SQL patch is installed or independently certified',()=>{
 const note=fs.readFileSync('AUDITORIA_DOCUMENTO_ANULACION_V246_PENDIENTE.md','utf8');
 assert.match(note,/NO APLICADA EN QA/);
 assert.match(note,/PR en borrador/);
 assert.match(note,/ROLLBACK/);
 assert.match(note,/NO AUTORIZADO/);
});
