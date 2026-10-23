import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(here,'../..');
const mock=path.join(here,'mocks.jsx');
const substitutes=[
 '@/components/DashboardLayout',
 '@/context/AuthContext',
 '@/components/ui/use-toast',
 '@/lib/supabaseClient',
 '@/lib/institutionalDialog',
 '@/services/laterNoteReconciliationService'
];
export default defineConfig({
 root:here,
 plugins:[react()],
 resolve:{
  alias:[...substitutes.map(find=>({find,replacement:mock})),{find:'@',replacement:path.join(project,'src')}],
  dedupe:['react','react-dom','react-router-dom']
 },
 server:{host:'127.0.0.1',port:4179,strictPort:true,fs:{allow:[project,here]}},
});
