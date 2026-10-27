import React,{useEffect,useState}from'react';
import {createRoot}from'react-dom/client';
import {BrowserRouter}from'react-router-dom';
import {MockAuthProvider}from'./mockAuth.jsx';
import SacrPage from '@/pages/parish/SacramentalNotificationsPage.jsx';
import OfficialPage from '@/pages/parish/ParishNotificationsPage.jsx';
import ConfirmationPage from '@/pages/parish/ConfirmationNotificationPage.jsx';
import '@/index.css';
window.__qa222={pending:[],calls:[],toasts:[],page:'sacr',changeUser:()=>{},setPage:()=>{},resolve:(kind,scopeId,data)=>{
 const qa=window.__qa222;
 const matches=qa.pending.filter(p=>p.kind===kind&&p.scopeId===scopeId);
 qa.pending=qa.pending.filter(p=>!matches.includes(p));
 matches.forEach(p=>p.resolve(data));
 return matches.length;
}};
function App(){const [page,setPage]=useState('sacr');
 useEffect(()=>{window.__qa222.setPage=x=>{window.__qa222.page=x;setPage(x);}},[]);
 return page==='sacr'?<SacrPage/>:page==='official'?<OfficialPage/>:<ConfirmationPage/>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><MockAuthProvider><App/></MockAuthProvider></BrowserRouter>);