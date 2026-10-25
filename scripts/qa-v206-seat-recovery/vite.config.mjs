import path from 'node:path';import {fileURLToPath} from 'node:url';import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const dir=path.dirname(fileURLToPath(import.meta.url));const mock=p=>path.resolve(dir,p);
export default defineConfig({root:dir,plugins:[react()],resolve:{alias:[
...['context/AppDataContext','context/AuthContext','services/funeralService','services/sacramentParametersService','services/sacramentsService','services/marginalNotesTemplatesService','components/ui/use-toast','lib/supabaseClient','lib/institutionalDialog','hooks/useSacramentalAuxiliaries'].map(p=>({find:new RegExp('^@/'+p+'$'),replacement:mock('mockServices.js')})),
{find:/^@\/components\/DashboardLayout$/,replacement:mock('../qa-v196-print-buttons/mockLayout.jsx')},
...['BaptismTicket','ConfirmationTicket','MarginalNotesRecordPanel','AuxiliaryAutocomplete','ChurchLocationAutocomplete','sacramental/HistoricalEntryModePanel'].map(p=>({find:new RegExp('^@/components/'+p+'$'),replacement:mock('mockComponent.jsx')})),
{find:/^@\/services\/historicalRegistryService$/,replacement:mock('mockServices.js')},
{find:'@',replacement:path.resolve(dir,'../../src')}
]},server:{host:'127.0.0.1',port:4856,strictPort:true}});
