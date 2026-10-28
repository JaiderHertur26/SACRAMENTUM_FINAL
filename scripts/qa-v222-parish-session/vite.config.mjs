import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
const dir=path.dirname(fileURLToPath(import.meta.url)),mock=n=>path.join(dir,n);
export default defineConfig({
 root:dir,plugins:[react()],
 resolve:{alias:[
 {find:/^@\/context\/AuthContext$/,replacement:mock('mockAuth.jsx')},
 {find:/^@\/context\/AppDataContext$/,replacement:mock('mockAppData.jsx')},
 {find:/^@\/components\/DashboardLayout$/,replacement:mock('mockLayout.jsx')},
 {find:/^@\/components\/ui\/use-toast$/,replacement:mock('mockToast.js')},
 {find:/^@\/components\/TablaAvisos$/,replacement:mock('mockTable.jsx')},
 {find:/^@\/components\/ModalVerAviso$/,replacement:mock('mockModal.jsx')},
 {find:/^@\/components\/ModalVerAcuseSacramental$/,replacement:mock('mockModal.jsx')},
 {find:/^@\/components\/ModalVincularPartidaNotificacion$/,replacement:mock('mockModal.jsx')},
 {find:/^@\/components\/ui\/ConfirmationDialog$/,replacement:mock('mockModal.jsx')},
 {find:/^@\/services\/matrimonialNotificationsService$/,replacement:mock('mockSacramental.js')},
 {find:/^@\/services\/sacramentalPhysicalLocatorV277$/,replacement:mock('mockPhysicalV277.js')},
 {find:/^@\/services\/officialNotificationsService$/,replacement:mock('mockOfficial.js')},
 {find:/^@\/services\/confirmationNotificationService$/,replacement:mock('mockConfirmation.js')},
 {find:'@',replacement:path.resolve(dir,'../../src')}
 ]},
 server:{host:'127.0.0.1',port:4886,strictPort:true}
});