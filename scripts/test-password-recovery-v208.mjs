import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync('src/services/passwordRecoveryService.js','utf8');
const {validateNewPassword,completePasswordResetWithClient}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const [password,confirmation] of [['short','short'],['12345678','different'],['x'.repeat(257),'x'.repeat(257)]])test('V208 invalid password does not make any auth request: '+password.length,async()=>{
 let calls=0;const client={auth:{getUser:async()=>{calls++;throw Error('must not run')}}};assert.ok(validateNewPassword(password,confirmation));await assert.rejects(()=>completePasswordResetWithClient(client,password,confirmation));assert.equal(calls,0);
});
test('V208 missing or expired server identity cannot update a password',async()=>{
 let updates=0;const client={auth:{getUser:async()=>({data:{user:null},error:Error('expired')}),updateUser:async()=>{updates++}}};
 await assert.rejects(()=>completePasswordResetWithClient(client,'valid-passphrase','valid-passphrase'),/caducado/);assert.equal(updates,0);
});
test('V208 password update validates live identity and confirms the same user',async()=>{
 const calls=[];const client={auth:{getUser:async()=>{calls.push('getUser');return {data:{user:{id:'qa-user'}},error:null}},updateUser:async data=>{calls.push(data);return {data:{user:{id:'qa-user'}},error:null}}}};
 assert.deepEqual(await completePasswordResetWithClient(client,'valid-passphrase','valid-passphrase'),{success:true});assert.deepEqual(calls,['getUser',{password:'valid-passphrase'}]);
});
test('V208 mismatched confirmation identity cannot report success',async()=>{
 const client={auth:{getUser:async()=>({data:{user:{id:'qa-user'}}}),updateUser:async()=>({data:{user:{id:'another-user'}}})}};
 await assert.rejects(()=>completePasswordResetWithClient(client,'valid-passphrase','valid-passphrase'),/confirmar/);
});
test('V208 server rejection is preserved without falsely reporting a reset',async()=>{
 const rejection=Error('network failure');const client={auth:{getUser:async()=>({data:{user:{id:'qa-user'}}}),updateUser:async()=>({error:rejection})}};
 await assert.rejects(()=>completePasswordResetWithClient(client,'valid-passphrase','valid-passphrase'),e=>e===rejection);
});
