import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route,useLocation} from 'react-router-dom';
import BaptismSentarRegistrosPage from '@/pages/parish/BaptismSentarRegistrosPage';
import ParishDecreeQueueV325 from '@/components/parish/ParishDecreeQueueV325';
import ParishDecreeSeatPanelV280 from '@/components/parish/ParishDecreeSeatPanelV280';
import '@/index.css';import {decreeIds} from './mocks';
const params=new URLSearchParams(location.search),screen=params.get('screen');
function Destination(){const loc=useLocation();return <p data-destination>{loc.pathname}</p>;}
const content=screen==='queue'?<ParishDecreeQueueV325/>:screen==='decree'?<ParishDecreeSeatPanelV280 decreeId={decreeIds[params.has('second')?1:0]}/>:<BaptismSentarRegistrosPage/>;
createRoot(document.getElementById('root')).render(<BrowserRouter><Routes><Route path="/" element={content}/><Route path="*" element={<Destination/>}/></Routes></BrowserRouter>);
