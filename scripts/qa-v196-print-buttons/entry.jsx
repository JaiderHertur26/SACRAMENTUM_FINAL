import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
import ViewBaptismPartidaModal from '@/components/modals/ViewBaptismPartidaModal';
import ViewConfirmationPartidaModal from '@/components/modals/ViewConfirmationPartidaModal';
import ViewMarriagePartidaModal from '@/components/modals/ViewMarriagePartidaModal';
import FuneralPartidasPage from '@/pages/parish/FuneralPartidasPage';
import '@/index.css';

const code=new URLSearchParams(location.search).get('type')||'bautismo';
window.__qa196={registerCalls:[],toasts:[],deny:false,printed:0,popups:0,popupClosed:0,popupHtml:'',clicked:0};
const parish={diocesis:'ARQUIDIÓCESIS DE BARRANQUILLA',nombre:'PARROQUIA FICTICIA QA V196',ciudad:'BARRANQUILLA',
 parroco:'PBRO. PRUEBA FICTICIA',id:'00000000-0000-4000-a000-000000000112'};
const raw={Libro:'9999',folio:'9998',numero:'9997',nombres:'REGISTRO HISTÓRICO DISTINTO'};
const common={
 id:'00000000-0000-4000-a000-000000000196',parish_id:parish.id,
 book_type:'ordinario',book_number:'31',folio:'442',number:'888',
 Libro:'31',numero:'888',status:'seated',updated_at:'2026-10-24T12:00:00.000Z',
 celebration_date:'2026-10-24',nombres:'MARÍA',apellidos:'FICTICIA V196',
 raw_data:raw,parishName:parish.nombre,dioceseName:parish.diocesis,nombre_padre:'PADRE QA',nombre_madre:'MADRE QA',
 groomName:'JUAN',groomSurname:'FICTICIO',brideName:'MARÍA',brideSurname:'FICTICIA'
};
const modal=code==='bautismo'?<ViewBaptismPartidaModal isOpen onClose={()=>{}} partida={common} auxiliaryData={parish}/>:
code==='confirmacion'?<ViewConfirmationPartidaModal isOpen onClose={()=>{}} partida={common} auxiliaryData={parish}/>:
code==='matrimonio'?<ViewMarriagePartidaModal isOpen onClose={()=>{}} partida={common} auxiliaryData={parish}/>:
code==='exequias'?<FuneralPartidasPage/>:<div>Unknown</div>;
createRoot(document.getElementById('root')).render(<BrowserRouter>{modal}</BrowserRouter>);
