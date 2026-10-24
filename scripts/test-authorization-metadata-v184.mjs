import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {scanAuthSource} from './verify-authorization-metadata-v184.mjs';
const fixture = (content,name='Auth.jsx') => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sacramentum-v184-'));
 try {fs.writeFileSync(path.join(root,name),content);return scanAuthSource(root);}
 finally {fs.rmSync(root,{force:true,recursive:true});}
};
test('V184: safe role comes from institutional user_profiles',()=>{
 const x=fixture('const role=profile.role; const active=profile.is_active && profile.status==="ACTIVE";');
 assert.equal(x.filesScanned,1);assert.deepEqual(x.hits,[]);
});
test('V184: client source may not authorize by user_metadata',()=>{
 assert.deepEqual(fixture('if (session.user.user_metadata.role==="diocese") grant();').hits,['Auth.jsx']);
});
test('V184: raw_user_meta_data is blocked regardless of capitalization',()=>{
 assert.deepEqual(fixture('const ok=auth.RAW_USER_META_DATA.role;', 'helper.ts').hits,['helper.ts']);
});
test('V184: non-executable assets do not create role false positives',()=>{
 assert.deepEqual(fixture('user_metadata','README.txt').hits,[]);
});
