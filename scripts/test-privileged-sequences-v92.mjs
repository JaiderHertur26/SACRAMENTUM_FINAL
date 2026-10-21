// V92: regresiones estáticas de numeración documental.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261021174920_block_direct_document_sequence_v92.sql'),'utf8');
const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(ent=>{
 const p=path.join(d,ent.name);
 return ent.isDirectory()?walk(p):/\.(js|jsx|mjs)$/.test(ent.name)?[p]:[];
});
const srcFiles=walk(path.join(root,'src'));
const directCalls=srcFiles.filter(p=>/\.rpc\s*\(\s*['"]next_document_sequence['"]/.test(fs.readFileSync(p,'utf8')));
const unusedWrapper=srcFiles.filter(p=>/nextDocumentNumber/.test(fs.readFileSync(p,'utf8')));

test('El asignador de números internos revoca EXECUTE a authenticated',()=>{
 assert.match(sql,/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.next_document_sequence\s*\(\s*uuid\s*,\s*text\s*,\s*text\s*\)/i);
 assert.match(sql,/FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i);
});
test('La migración no cambia consecutivos ni borra documentos',()=>{
 assert.doesNotMatch(sql,/\b(?:update|delete\s+from|truncate|insert\s+into)\s+public\.document_sequences\b/i);
 assert.doesNotMatch(sql,/\b(?:drop\s+table|drop\s+function)\b/i);
});
test('Ningún cliente web consume un consecutivo llamando directamente la RPC',()=>{
 assert.deepEqual(directCalls.map(p=>path.relative(root,p)),[]);
});
test('No queda adaptador web obsoleto para la función revocada',()=>{
 assert.deepEqual(unusedWrapper.map(p=>path.relative(root,p)),[]);
});
test('El cambio conserva SERVICE_ROLE y el dueño para llamadas internas',()=>{
 assert.doesNotMatch(sql,/\bFROM\s+(?:[^\n;]*,\s*)?service_role/i);
 assert.doesNotMatch(sql,/\bDROP\s+(?:FUNCTION|OWNED)\b/i);
});
