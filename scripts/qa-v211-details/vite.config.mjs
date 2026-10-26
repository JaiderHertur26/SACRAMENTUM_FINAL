import path from 'node:path';import {fileURLToPath} from 'node:url';import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const dir=path.dirname(fileURLToPath(import.meta.url));const mock=x=>path.join(dir,x);
export default defineConfig({root:dir,plugins:[react()],resolve:{alias:[
{find:/^@\/context\/AuthContext$/,replacement:mock('mockAuth.jsx')},
{find:/^@\/lib\/supabaseClient$/,replacement:mock('mockSupabase.js')},
{find:/^@\/components\/DashboardLayout$/,replacement:mock('mockLayout.jsx')},
{find:/^@\/services\/sacramentsService$/,replacement:mock('mockSacraments.js')},
{find:/^@\/services\/marginalNotesV2Service$/,replacement:mock('mockNotes.js')},
{find:/^@\/components\/modals\/ViewBaptismPartidaModal$/,replacement:mock('mockPrintModal.jsx')},
{find:/^@\/components\/ui\/use-toast$/,replacement:mock('mockToast.js')},
{find:'@',replacement:path.resolve(dir,'../../src')}
]},server:{host:'127.0.0.1',port:4861,strictPort:true}});