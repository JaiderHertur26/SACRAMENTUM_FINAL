import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../../src/index.css';
import LaterNoteReconciliationPage from '../../src/pages/chancery/LaterNoteReconciliationPage.jsx';
createRoot(document.getElementById('root')).render(
 <MemoryRouter initialEntries={['/chancery/decretos/conciliaciones']}>
  <LaterNoteReconciliationPage/>
 </MemoryRouter>
);
