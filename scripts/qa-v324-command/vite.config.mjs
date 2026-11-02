import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(here,'../..');
const mock=path.join(here,'mocks.jsx');
const aliases=[
 '@/context/AuthContext','@/context/AppDataContext','@/lib/supabaseClient',
 '@/components/ui/use-toast','@/services/sacramentsService',
 '@/services/officialNotificationsService','@/services/matrimonialNotificationsService',
 '@/services/chatService','@/services/chanceryPendingService','@/services/decreeSeatsV280',
];
export default defineConfig({
 root:here,publicDir:path.join(root,'public'),plugins:[react()],
 resolve:{alias:[...aliases.map(find=>({find,replacement:mock})),{find:'@',replacement:path.join(root,'src')}],dedupe:['react','react-dom','react-router-dom']},
 server:{host:'127.0.0.1',port:4914,strictPort:true,fs:{allow:[root,here]}},
});
