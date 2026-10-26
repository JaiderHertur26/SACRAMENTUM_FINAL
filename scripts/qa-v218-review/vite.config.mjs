import path from 'node:path';import {fileURLToPath} from 'node:url';import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const dir=path.dirname(fileURLToPath(import.meta.url)),mock=n=>path.join(dir,n);
export default defineConfig({root:dir,plugins:[react()],resolve:{alias:[
 {find:/^@\/context\/AuthContext$/,replacement:mock('mockAuth.jsx')},
 {find:/^@\/components\/DashboardLayout$/,replacement:mock('mockLayout.jsx')},
 {find:/^@\/components\/ui\/use-toast$/,replacement:mock('mockToast.js')},
 {find:/^@\/lib\/supabaseClient$/,replacement:mock('mockSupabase.js')},
 {find:'@',replacement:path.resolve(dir,'../../src')}
]},server:{host:'127.0.0.1',port:4882,strictPort:true}});