import path from 'node:path';import {fileURLToPath} from 'node:url';import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const dir=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({root:dir,plugins:[react()],resolve:{alias:[
...['context/AppDataContext','context/AuthContext','services/marriagesCloudService','services/sacramentParametersService','services/sacramentsService','components/ui/use-toast','lib/supabaseClient','lib/institutionalDialog'].map(p=>({find:new RegExp('^@/'+p+'$'),replacement:path.resolve(dir,'mockServices.js')})),
{find:/^@\/components\/DashboardLayout$/,replacement:path.resolve(dir,'../qa-v196-print-buttons/mockLayout.jsx')},
{find:/^@\/components\/MatrimonioTicket$/,replacement:path.resolve(dir,'mockTicket.jsx')},
{find:'@',replacement:path.resolve(dir,'../../src')}
]},server:{host:'127.0.0.1',port:4855,strictPort:true}});
