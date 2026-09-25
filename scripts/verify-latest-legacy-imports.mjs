import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(Boolean).filter(x=>!x.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
const url=env.VITE_SUPABASE_URL; const key=env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY;
if(!url||!key) throw new Error('Faltan variables Supabase');
const s=createClient(url,key,{auth:{persistSession:false}});
const {data,error}=await s.from('legacy_import_batches').select('id,original_filename,profile_key,status,total_rows,valid_count,review_count,error_count,imported_count,parish_id,created_at,metadata').in('profile_key',['INSBAUTI','INSCONFI']).order('created_at',{ascending:false}).limit(10);
if(error){ console.log('READ_ERROR',error.code,error.message); process.exit(3); }
console.log(JSON.stringify(data,null,2));
