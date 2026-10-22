import path from 'node:path';import react from '@vitejs/plugin-react';import {defineConfig} from 'vite';
const project=process.cwd(),root=path.join(project,'scripts','qa-v131');
export default defineConfig({root,publicDir:false,plugins:[react()],resolve:{alias:[
{find:'@/context/AuthContext',replacement:path.join(root,'mock-auth.jsx')},
{find:'@/lib/supabaseClient',replacement:path.join(root,'mock-supabase.js')},
{find:'@/lib/institutionalDialog',replacement:path.join(root,'mock-dialog.js')},
{find:'@',replacement:path.join(project,'src')}]
},server:{host:'127.0.0.1',port:4814,strictPort:true,fs:{allow:[project]}}});