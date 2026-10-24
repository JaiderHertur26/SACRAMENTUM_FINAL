import path from 'node:path';import {fileURLToPath} from 'node:url';import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const dir=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({root:dir,plugins:[react()],resolve:{alias:[
 {find:/^@\/context\/AppDataContext$/,replacement:path.resolve(dir,'mockAppData.js')},
 {find:'@',replacement:path.resolve(dir,'../../src')}
]},server:{host:'127.0.0.1',port:4845,strictPort:true}});
