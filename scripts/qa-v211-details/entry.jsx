import React,{useEffect} from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route,useNavigate}from'react-router-dom';import{MockAuthProvider}from'./mockAuth.jsx';import DecreeDetail from '@/pages/parish/ParishDecreeDetailPage';import BaptismDetail from '@/pages/BaptismDetailPage';import '@/index.css';
window.__qa211={calls:[],toasts:[],popupHtml:'',popups:0,scenario:'normal',printed:0};
function Controls(){const navigate=useNavigate();useEffect(()=>{window.__qa211.navigate=path=>navigate(path)},[navigate]);return <span data-qa-controls="true"/>}
createRoot(document.getElementById('root')).render(<MockAuthProvider><BrowserRouter><Controls/><Routes>
<Route path="/parish/decrees/:decreeId" element={<DecreeDetail/>}/>
<Route path="/parroquia/bautismo/:baptismPartidaId" element={<BaptismDetail/>}/>
<Route path="*" element={<span>QA unknown route</span>}/></Routes></BrowserRouter></MockAuthProvider>);