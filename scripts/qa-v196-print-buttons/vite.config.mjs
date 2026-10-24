import path from 'node:path';import {fileURLToPath} from 'node:url';import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const dir=path.dirname(fileURLToPath(import.meta.url));
const mock=name=>path.resolve(dir,name);
export default defineConfig({root:dir,plugins:[react()],resolve:{alias:[
{find:/^@\/context\/AppDataContext$/,replacement:mock('mockAppData.js')},
{find:/^@\/context\/AuthContext$/,replacement:mock('mockAuth.js')},
{find:/^@\/components\/DashboardLayout$/,replacement:mock('mockLayout.jsx')},
{find:/^@\/components\/MarginalNoteComposer$/,replacement:mock('mockComposer.jsx')},
{find:/^@\/services\/marginalNotesV2Service$/,replacement:mock('mockNotes.js')},
{find:/^@\/services\/marginalNotesTemplatesService$/,replacement:mock('mockTemplates.js')},
{find:/^@\/services\/funeralService$/,replacement:mock('mockFunerals.js')},
{find:/^@\/components\/ui\/use-toast$/,replacement:mock('mockToast.js')},
{find:'@',replacement:path.resolve(dir,'../../src')}
]},server:{host:'127.0.0.1',port:4846,strictPort:true}});
