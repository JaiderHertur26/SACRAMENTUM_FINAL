import React from 'react';
import {createRoot} from 'react-dom/client';
import BaptismPrintTemplate from '@/components/BaptismPrintTemplate';
import ConfirmationPrintTemplate from '@/components/ConfirmationPrintTemplate';
import MatrimonioPrintTemplate from '@/components/MatrimonioPrintTemplate';
import {buildFuneralPartidaHtml} from '@/utils/funeralDocumentHtml';
import '@/index.css';
const params=new URLSearchParams(location.search);
const code=params.get('type')||'bautismo';
const attack=params.get('xss')==='1';
const injection='<img src=x onerror=window.__qaV195Injected=1>';
const parish={diocesis:'ARQUIDIÓCESIS DE BARRANQUILLA',nombre:attack?'PARROQUIA <svg onload=window.__qaV195Injected=1>':'PARROQUIA FICTICIA QA V195',ciudad:'BARRANQUILLA',parroco:'PBRO. PRUEBA FICTICIA'};
const raw={Libro:'9999',libro:'9999',book_number:'9999',folio:'9998',page_number:'9998',numero:'9997',number:'9997',
 nombres:'PERSONA RAW ANTIGUA',apellidos:'NO ES TITULAR',fechaSacramento:'2001-01-01',
 novioNombres:'NOVIO HISTÓRICO',novioApellidos:'DIFERENTE',noviaNombres:'NOVIA HISTÓRICA',noviaApellidos:'DIFERENTE',
 notaMarginal:attack?injection:'',lugarNacimiento:attack?injection:''};
const common={id:'00000000-0000-4000-a000-000000000195',parish_id:'00000000-0000-4000-a000-000000000112',
 book_type:'ordinario',book_number:'31',folio:'442',number:'888',status:'seated',celebration_date:'2026-10-24',
 nombres:attack?injection:'MARÍA',apellidos:'FICTICIA V195',raw_data:raw,parishName:parish.nombre,dioceseName:parish.diocesis,
 nombre_padre:attack?injection:'PADRE QA',nombre_madre:'MADRE QA',
 notaMarginal:attack?injection:'',nota_marginal:attack?injection:''};
const marriage={...common,groomName:attack?injection:'JUAN',groomSurname:'FICTICIO',brideName:'MARÍA',brideSurname:'FICTICIA'};
const funeral={...common,fecha_nacimiento:'1940-04-07',fecha_defuncion:'2026-10-20',fecha_exequias:'2026-10-24'};
const template=code==='bautismo'?<BaptismPrintTemplate data={common} parroquiaInfo={parish}/>:
 code==='confirmacion'?<ConfirmationPrintTemplate data={common} parroquiaInfo={parish}/>:
 code==='matrimonio'?<MatrimonioPrintTemplate data={marriage} parroquiaInfo={parish}/>:null;
const html=code==='exequias'?buildFuneralPartidaHtml({record:funeral,notes:[],institution:{dioceseName:parish.diocesis,parishName:parish.nombre,city:'Barranquilla'}}).replace(/<script>[\s\S]*?<\/script>/ig,''):null;
createRoot(document.getElementById('root')).render(<main data-qa-v195={code} style={{background:'#edf0f6',minHeight:'100vh',padding:20}}>
 {html?<iframe title="Partida Exequias QA" data-testid="funeral-document" srcDoc={html} style={{width:'8.5in',height:'11in',border:0,display:'block',margin:'auto',background:'white'}}/>:
 <div data-testid="sacramental-document" style={{width:'8.5in',minHeight:'11in',margin:'auto',background:'white'}}>{template}</div>}
 </main>);
window.__v195={type:code,expected:{book:'31',folio:'442',number:'888'},method:'Real React isolated, synthetic only'};
