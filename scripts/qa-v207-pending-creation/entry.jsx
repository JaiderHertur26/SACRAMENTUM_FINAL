import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
import Baptism from '@/pages/parish/BaptismNewPage';import Confirmation from '@/pages/parish/ConfirmationNewPage';import Marriage from '@/pages/parish/MatrimonioNewPage';import Funeral from '@/pages/parish/FuneralRegistryPage';import '@/index.css';
const p=new URLSearchParams(location.search),kind=p.get('kind'),scenario=p.get('case');
window.__qa207={kind,scenario,calls:[],receipts:new Map(),rows:[],next:1,toasts:[],printed:0,reads:0};
window.print=()=>window.__qa207.printed++;
const Page=kind==='bautismo'?Baptism:kind==='confirmacion'?Confirmation:kind==='matrimonio'?Marriage:Funeral;
createRoot(document.getElementById('root')).render(<BrowserRouter><Page/></BrowserRouter>);
