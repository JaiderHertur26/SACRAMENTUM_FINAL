import path from 'node:path';import fs from 'node:fs';import os from 'node:os';import {fileURLToPath} from 'node:url';import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const dir=path.dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(fs.readFileSync(process.env.QA208_AUTH_CONFIG||path.join(os.tmpdir(),'sacramentum-qa208-private.json'),'utf8'));
export default defineConfig({root:dir,plugins:[react()],define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(config.url),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify(config.apiKey)},resolve:{alias:[{find:'@',replacement:path.resolve(dir,'../../src')}]},server:{host:'127.0.0.1',port:4858,strictPort:true}});
