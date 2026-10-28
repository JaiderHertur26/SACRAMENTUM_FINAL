import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const mock=path.join(here,'mocks.jsx');
const aliases=[
 '@/context/AuthContext',
 '@/services/officialNotificationsService',
 '@/services/matrimonialNotificationsService',
 '@/services/sacramentalPhysicalLocatorV277',
 '@/services/chatService'
];
export default defineConfig({
 root:here,
 publicDir:path.join(root,'public'),
 plugins:[react()],
 resolve:{alias:[...aliases.map(find=>({find,replacement:mock})),{find:'@',replacement:path.join(root,'src')}],dedupe:['react','react-dom','react-router-dom']},
 server:{host:'127.0.0.1',port:4897,strictPort:true,fs:{allow:[root,here]}}
});
