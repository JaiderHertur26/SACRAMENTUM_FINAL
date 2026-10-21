import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261021214213_institutional_document_authority_v102.sql'),'utf8');
const ui=fs.readFileSync(path.join(root,'src/pages/DocumentTemplateLibraryPage.jsx'),'utf8');

test('V102 modifica exclusivamente tres funciones con firmas explícitas',()=>{
 for(const sig of [
  'issue_document_from_template(uuid,jsonb,uuid,text,uuid,jsonb)',
  'void_document_issuance(uuid,text)',
  'save_document_template(text,text,text,text,text,uuid,uuid,jsonb)'
 ]) assert.ok(sql.includes(sig),sig);
 assert.equal((sql.match(/EXECUTE\s+(?:v_new|replace\(v_src,v_old,v_new\))/g)||[]).length,3);
});
test('V102 elimina la rama de emisión global Admin General',()=>{
 assert.match(sql,/v_start:=strpos\(v_src,\s*E'.*admin_general.*then/i);
 assert.match(sql,/v_end:=strpos\(v_src,\s*E'.*Rol no autorizado para emitir documentos/i);
 assert.match(sql,/substring\(v_src\s+FROM\s+1\s+FOR\s+v_start-1\)/);
});
test('V102 suprime permiso de anular documentos de toda parroquia',()=>{
 assert.match(sql,/v_old:=E'if v_role=''admin_general'' then null;/i);
 assert.match(sql,/v_new:='if v_role=''parish'''/);
});
test('V102 permite Admin General solo en ámbito plantillas system',()=>{
 assert.match(sql,/if v_scope<>''system'' then raise exception/i);
 assert.match(sql,/v_diocese:=null; v_parish:=null;/i);
});
test('Los permisos específicos de diócesis y parroquia permanecen en el código original',()=>{
 assert.match(sql,/v_new:='if v_role=''parish'''/);
 assert.match(sql,/elsif v_role in \(''diocese'',''chancery''\)/i);
});
test('V102 falla cerrada si cambia algún bloque institucional',()=>{
 assert.match(sql,/IF v_start=0 OR v_end<=v_start THEN/i);
 assert.ok((sql.match(/length\(v_src\)-length\(replace\(v_src,v_old,''\)\)<>length\(v_old\)/g)||[]).length>=2);
 assert.ok((sql.match(/RAISE EXCEPTION 'V102:/g)||[]).length>=3);
});
test('V102 preserva las tres definiciones entre Windows CRLF y Linux LF',()=>{
 assert.equal((sql.match(/replace\(v_src,E'\\r\\n',E'\\n'\)/g)||[]).length,3);
});
test('V102 no altera filas ni consecutivos ya registrados',()=>{
 assert.doesNotMatch(sql,/^\s*(?:DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+public\.|TRUNCATE|ALTER\s+TABLE)\b/im);
});
test('Biblioteca UI no ofrece editar plantillas ajenas al Administrador General',()=>{
 assert.match(ui,/role === 'admin_general' && selected\?\.scope_type === 'system'/);
});
test('Biblioteca UI limita diócesis/cancillería a plantilla de su diócesis',()=>{
 assert.match(ui,/selected\?\.scope_type === 'diocese'/);
 assert.match(ui,/String\(selected\?\.diocese_id\)\s*===\s*String\(ownDioceseId\)/);
});
