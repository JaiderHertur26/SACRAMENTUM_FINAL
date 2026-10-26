import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { isTestRegistryData } from '@/utils/testDocumentStamp.mjs';

// Mark the actual print root, not only the visible application dashboard.
document.documentElement.dataset.registryDataMode = isTestRegistryData() ? 'test' : 'official';

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
);