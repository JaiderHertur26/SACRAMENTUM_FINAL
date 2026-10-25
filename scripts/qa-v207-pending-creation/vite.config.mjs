import path from 'node:path';import {fileURLToPath} from 'node:url';import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const dir=path.dirname(fileURLToPath(import.meta.url)),mock=p=>path.resolve(dir,p);
export default defineConfig({root:dir,plugins:[react()],resolve:{alias:[
...['context/AuthContext','context/AppDataContext','components/ui/use-toast','hooks/useSacramentalAuxiliaries','lib/supabaseClient'].map(p=>({find:new RegExp('^@/'+p+'$'),replacement:mock('mockClient.js')})),
{find:/^@\/hooks\/useParroquiaFromMisDatos$/,replacement:mock('mockParish.js')},
{find:/^@\/components\/DashboardLayout$/,replacement:mock('../qa-v196-print-buttons/mockLayout.jsx')},
...['BaptismTicket','ConfirmationTicket','MatrimonioTicket','CityAutocomplete','AuxiliaryAutocomplete','ChurchLocationAutocomplete','MarginalNotesRecordPanel','sacramental/HistoricalEntryModePanel','modals/SearchBaptismPartidaModal'].map(p=>({find:new RegExp('^@/components/'+p+'$'),replacement:mock('../qa-v206-seat-recovery/mockComponent.jsx')})),
{find:'@',replacement:path.resolve(dir,'../../src')}
]},server:{host:'127.0.0.1',port:4857,strictPort:true}});
