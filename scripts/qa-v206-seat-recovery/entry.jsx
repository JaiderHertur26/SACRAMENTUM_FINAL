import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
import Baptism from '@/pages/parish/BaptismSentarRegistrosPage';import Confirmation from '@/pages/parish/ConfirmationSentarRegistrosPage';import Funeral from '@/pages/parish/FuneralRegistryPage';import '@/index.css';
const params=new URLSearchParams(location.search),kind=params.get('kind'),scenario=params.get('case');
const raw=n=>({nombres:'PERSONA FICTICIA '+n,apellidos:'QA V206',fechaSacramento:'2026-01-01',fecha_defuncion:'2026-01-01',fecha_exequias:'2026-01-02',numeroRegistro:String(n).padStart(6,'0')});
window.__qa206={kind,scenario,pending:[1,2,3].map(n=>({id:'qa-'+n,reportado:false,status:'pending',parish_id:'qa-parish',numero_registro:String(n).padStart(6,'0'),fecha_exequias:'2026-01-02',raw_data:raw(n)})),reported:[],calls:[],toasts:[],reads:0,next:1,failRead:scenario==='initial-read-error'?'pending-only':false,confirm:true,confirmCalls:0};
const Page=kind==='bautismo'?Baptism:kind==='confirmacion'?Confirmation:Funeral;
createRoot(document.getElementById('root')).render(<BrowserRouter><Page/></BrowserRouter>);
