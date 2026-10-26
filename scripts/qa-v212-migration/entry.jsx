import React from 'react';import {createRoot}from'react-dom/client';import{MockAuthProvider}from'./mockAuth.jsx';import Page from '@/pages/admin/LegacyMigrationCenterPage';import '@/index.css';
window.__qa212={created:[],staged:[],applied:[],toasts:[],scenario:'normal',batch:null};
createRoot(document.getElementById('root')).render(<MockAuthProvider><Page/></MockAuthProvider>);