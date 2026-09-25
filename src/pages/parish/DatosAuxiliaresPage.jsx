import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Helmet } from 'react-helmet';
import { cn } from '@/lib/utils';
import { Church, MapPin, User, Users, Landmark, FileText } from 'lucide-react';

import DiocesisList from './auxiliary/DiocesisList';
import IglesiasList from './auxiliary/IglesiasList';
import ObisposList from './auxiliary/ObisposList';
import BishopTenuresList from './auxiliary/BishopTenuresList';
import ParrocosList from './auxiliary/ParrocosList';
import CiudadesList from './auxiliary/CiudadesList';
import MisDatosList from './auxiliary/MisDatosList';

const DatosAuxiliaresPage = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('diocesis');

    const tabs = [
        { id: 'diocesis', label: 'Diócesis', icon: Landmark, component: <DiocesisList /> },
        { id: 'iglesias', label: 'Iglesias', icon: Church, component: <IglesiasList /> },
        { id: 'obispos', label: 'Obispos / Ministros', icon: User, component: <ObisposList /> },
        { id: 'obispos-titulares', label: 'Obispos Titulares', icon: Landmark, component: <BishopTenuresList /> },
        { id: 'parrocos', label: 'Párrocos', icon: Users, component: <ParrocosList /> },
        { id: 'ciudades', label: 'Ciudades', icon: MapPin, component: <CiudadesList /> },
        { id: 'misdatos', label: 'Mis Datos', icon: FileText, component: <MisDatosList /> },
    ];

    return (
        <DashboardLayout entityName={user?.parishName || "Parroquia"}>
            <Helmet>
                <title>Datos Auxiliares · SACRAMENTUM</title>
            </Helmet>
            
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[#111111]">Datos Auxiliares</h1>
                <p className="text-slate-500 mt-1">Gestionar listas auxiliares y catálogos del sistema.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
                {/* Tabs Header */}
                <div className="flex overflow-x-auto border-b border-slate-200 scrollbar-hide bg-slate-50/50">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all whitespace-nowrap border-b-2 outline-none",
                                activeTab === tab.id 
                                    ? "border-[#D4AF37] text-[#111111] bg-white" 
                                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                            )}
                        >
                            <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-[#D4AF37]" : "text-slate-400")} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="p-6 flex-1 bg-white">
                    {tabs.find(t => t.id === activeTab)?.component}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default DatosAuxiliaresPage;