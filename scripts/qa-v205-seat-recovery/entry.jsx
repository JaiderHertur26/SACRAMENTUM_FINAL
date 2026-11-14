import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
import InstitutionalDialogHost from '@/components/ui/InstitutionalDialogHost';
import MatrimonioSentarRegistrosPage from '@/pages/parish/MatrimonioSentarRegistrosPage';import '@/index.css';
const scenario=new URLSearchParams(location.search).get('case')||'individual-reject';
window.__qa205={scenario,pending:[1,2,3].map(n=>({id:'qa-'+n,numeroRegistro:String(n).padStart(6,'0'),novioNombres:'NOVIO FICTICIO '+n,noviaNombres:'NOVIA FICTICIA '+n,fechaSacramento:'2026-01-01'})),reported:[],calls:[],toasts:[],reads:0,next:1,failRead:scenario==='initial-read-error'};
createRoot(document.getElementById('root')).render(<BrowserRouter><MatrimonioSentarRegistrosPage/><InstitutionalDialogHost/></BrowserRouter>);
