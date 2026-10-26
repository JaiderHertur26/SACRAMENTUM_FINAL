import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '@babel/parser';

// Exercise the actual AuthProvider loadProfile implementation, not a copy.
const source=fs.readFileSync('src/context/AuthContext.jsx','utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});
const provider=ast.program.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.declarations?.some(d=>d.id.name==='AuthProvider'))
 .declaration.declarations.find(d=>d.id.name==='AuthProvider').init;
const declaration=provider.body.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='loadProfile'));
assert.ok(declaration,'AuthProvider must provide loadProfile');
const fnSource=source.slice(declaration.declarations[0].init.start,declaration.declarations[0].init.end);
const identity={id:'auth-real-user',email:'same@example.invalid'};

const attempt=async (profile, opts={})=>{
 const visited=[];
 let scopeCalls=0;
 const client={from:table=>({
  select(){return this},
  eq(column,value){visited.push({table,column,value});return this},
  async maybeSingle(){return {data:profile,error:null}}
 })};
 const loadProfile=new Function('supabase','normalizeRole','validateProfileScope',`return (${fnSource});`)(
  client,role=>role,()=>{scopeCalls++;return {valid:true}}
 );
 const result=await loadProfile(identity);
 return {result,visited,scopeCalls};
};

test('V209 rejects an active profile belonging to another Auth ID, despite matching email',async()=>{
 const {result,scopeCalls}=await attempt({id:'other-profile',auth_user_id:'other-auth',email:identity.email,role:'admin_general',is_active:true});
 assert.equal(result.ok,false);
 assert.match(result.message,/no corresponde/i);
 assert.equal(scopeCalls,0);
});
test('V209 rejects an unbound legacy profile discovered by email fallback',async()=>{
 const {result}=await attempt({id:'other-profile',auth_user_id:null,email:identity.email,role:'admin_general'});
 assert.equal(result.ok,false);
});
test('V209 preserves correctly linked profiles when profile ID differs from auth user ID',async()=>{
 const {result}=await attempt({id:'profile-row-uuid',auth_user_id:identity.id,email:identity.email,role:'admin_general'});
 assert.equal(result.ok,true);
 assert.equal(result.user.id,identity.id);
 assert.equal(result.user.role,'admin_general');
});
test('V209 accepts a legitimate legacy record only when its ID itself matches Auth user',async()=>{
 const {result}=await attempt({id:identity.id,auth_user_id:null,email:identity.email,role:'admin_general'});
 assert.equal(result.ok,true);
});
test('V209 refuses empty profile identity even when it looks active',async()=>{
 const {result}=await attempt({role:'admin_general',email:identity.email,is_active:true});
 assert.equal(result.ok,false);
});
