import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useLocation} from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import '@/index.css';
import {QA_ENTITY,QA_ROLE} from './mocks';
const routeName=(path)=>{
 const token=path.split('/').filter(Boolean).at(-1)||'Inicio';
 const aliases={dashboard:'Panel institucional',nuevo:'Nuevo asiento',celebrado:'Digitalización',partidas:'Libros y partidas',ajustes:'Ajustes',decretos:'Decretos',reports:'Informes sacramentales',ecclesiastical:'Organización eclesiástica',pending:'Pendientes',notifications:'Notificaciones',communications:'Comunicaciones',buscar:'Buscador sacramental'};
 return aliases[token]||token.replace(/[-_]/g,' ');
};
function SampleScreen(){
 const location=useLocation();
 const title=routeName(location.pathname);
 return <DashboardLayout entityName={QA_ENTITY}>
  <div data-v249-fixture="yes" className="max-w-6xl space-y-6">
   <section className="ecclesial-scope-hero">
    <div className="ecclesial-scope-eyebrow">Servicio eclesial · {QA_ROLE}</div>
    <h1 className="mt-3">{title}</h1>
    <p className="ecclesial-scope-description mt-2">Muestra visual aislada de navegación, tipografía y contenido. Todos los datos son ficticios.</p>
   </section>
   <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    {[['Archivo','12'],['Comunidades','4'],['Pendientes','2']].map(([label,value])=><article key={label} className="sacramentum-panel p-5"><div className="sacramentum-kicker">{label}</div><div className="mt-2 font-serif text-3xl font-bold">{value}</div></article>)}
   </div>
   <section className="sacramentum-form-shell p-5">
    <h2 className="sacramentum-page-title text-2xl">Consulta del archivo</h2>
    <p className="sacramentum-page-description">Un formulario sobrio, legible y con contraste suficiente.</p>
    <div className="mt-5 flex flex-col gap-3 md:flex-row">
     <div className="flex-1"><label htmlFor="fixtureSearch" className="sacramentum-field-label">Persona o partida</label><input id="fixtureSearch" className="sacramentum-field" placeholder="Nombre de prueba"/></div>
     <button className="rounded-xl bg-[#743549] px-5 py-2 font-semibold text-white" type="button">Buscar</button>
    </div>
   </section>
   <div className="sacramentum-table-shell overflow-x-auto">
    <table className="w-full text-left text-sm"><thead><tr><th className="p-3">Libro</th><th className="p-3">Folio</th><th className="p-3">Estado</th></tr></thead><tbody><tr><td className="p-3">Bautismo</td><td className="p-3">001</td><td className="p-3">En revisión</td></tr></tbody></table>
   </div>
  </div>
 </DashboardLayout>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><SampleScreen/></BrowserRouter>);
