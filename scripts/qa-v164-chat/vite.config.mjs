import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const mock=path.join(here,'mocks.jsx');
const overrides=['@/context/AuthContext','@/components/DashboardLayout','@/services/chatService'];
export default defineConfig({
 root:here,plugins:[react()],
 resolve:{alias:[...overrides.map(find=>({find,replacement:mock})),{find:'@',replacement:path.join(root,'src')}],
 dedupe:['react','react-dom']},
 server:{host:'127.0.0.1',port:4184,strictPort:true,fs:{allow:[root,here]}}
});
