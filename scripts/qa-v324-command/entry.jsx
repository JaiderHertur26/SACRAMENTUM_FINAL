import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,useLocation} from 'react-router-dom';
import ParishDashboard from '@/pages/parish/ParishDashboard';
import DioceseUserDashboard from '@/pages/diocese/DioceseUserDashboard';
import ChanceryDashboard from '@/pages/chancery/ChanceryDashboard';
import AdminGeneralDashboard from '@/pages/admin/AdminGeneralDashboard';
import '@/index.css';
import {QA_ROLE,QA_PATHS} from './mocks';
const components={parish:ParishDashboard,diocese:DioceseUserDashboard,chancery:ChanceryDashboard,admin_general:AdminGeneralDashboard};
function Destination(){const location=useLocation();return <p data-qa-destination>{location.pathname+location.search}</p>;}
function Application(){
 const Dashboard=components[QA_ROLE];
 return <Routes><Route path={QA_PATHS[QA_ROLE]} element={<Dashboard/>}/><Route path="*" element={<Destination/>}/></Routes>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><Application/></BrowserRouter>);
