import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import path from 'node:path';import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../..');
const mocks=['context/AuthContext','context/AppDataContext','components/ui/use-toast','services/sacramentParametersService','services/sacramentsService','services/officialNotificationsService','lib/supabaseClient','lib/institutionalDialog'];
export default defineConfig({root:dir,plugins:[react()],resolve:{alias:[
 ...mocks.map(p=>({find:new RegExp('^@/'+p+'$'),replacement:path.join(dir,'mocks.jsx')})),
 ...['DashboardLayout','BaptismTicket','LedgerSeatPanelV264'].map(p=>({find:new RegExp('^@/components/'+p+'$'),replacement:path.join(dir,'mockComponent.jsx')})),
 {find:'@',replacement:path.join(root,'src')}
]},server:{host:'127.0.0.1',port:4915,strictPort:true,fs:{allow:[root]}}});
