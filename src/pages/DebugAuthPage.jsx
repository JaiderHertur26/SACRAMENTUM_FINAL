import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, User, Database, Lock } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { buildDocumentTitle } from '@/config/brand';

const DebugAuthPage = () => {
    const auth = useAuth();
    const appData = useAppData();
    const navigate = useNavigate();

    const { user } = auth;

    const roleLabels = {
        admin_general: 'Administrador General',
        diocese: 'Diócesis / Arquidiócesis',
        parish: 'Parroquia',
        chancery: 'Cancillería',
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-12 font-sans">
            <Helmet><title>{buildDocumentTitle('Diagnóstico del sistema')}</title></Helmet>
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Diagnóstico del sistema</h1>
                            <p className="text-slate-500">Inspector de autenticación y contexto</p>
                        </div>
                    </div>
                    <div className="bg-blue-100 text-blue-800 text-xs font-mono py-1 px-3 rounded-full border border-blue-200">
                        /debug-auth
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Identidad de usuario */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-600" />
                            <h2 className="font-semibold text-slate-800">Identidad de usuario</h2>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="text-slate-500 text-sm">Usuario</span>
                                <span className="font-medium text-slate-900">{user?.username || 'No disponible'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="text-slate-500 text-sm">Email</span>
                                <span className="font-medium text-slate-900">{user?.email || 'No disponible'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="text-slate-500 text-sm">ID</span>
                                <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">{user?.id || 'No disponible'}</span>
                            </div>
                            <div className="flex justify-between pt-1">
                                <span className="text-slate-500 text-sm">Creado el</span>
                                <span className="text-xs text-slate-700">{user?.createdAt || 'No disponible'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Rol y acceso */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-blue-600" />
                            <h2 className="font-semibold text-slate-800">Rol y acceso</h2>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                <span className="text-slate-500 text-sm">Rol actual</span>
                                <span className="font-bold text-white bg-blue-600 px-3 py-1 rounded-full text-xs uppercase tracking-wider">
                                    {roleLabels[user?.role] || user?.role || 'Sin rol'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                <span className="text-slate-500 text-sm">Estado de autenticación</span>
                                <span className={`font-bold px-2 py-1 rounded text-xs ${auth.isAuthenticated() ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {auth.isAuthenticated() ? 'AUTENTICADO' : 'NO AUTENTICADO'}
                                </span>
                            </div>
                             <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="text-slate-500 text-sm">Contexto parroquial</span>
                                <span className="font-medium text-slate-900 text-right">{user?.parishName || 'Sin parroquia'}</span>
                            </div>
                            <div className="flex justify-between pt-1">
                                <span className="text-slate-500 text-sm">Contexto diocesano</span>
                                <span className="font-medium text-slate-900 text-right">{user?.dioceseName || 'Sin diócesis'}</span>
                            </div>
                        </div>
                    </div>

                     {/* Contexto de datos */}
                     <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                            <Database className="w-5 h-5 text-green-600" />
                            <h2 className="font-semibold text-slate-800">Contexto de datos</h2>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="text-slate-500 text-sm">Usuarios en memoria</span>
                                <span className="font-mono font-bold text-slate-900">{appData.data?.users?.length || 0}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="text-slate-500 text-sm">Parroquias en memoria</span>
                                <span className="font-mono font-bold text-slate-900">{appData.data?.parishes?.length || 0}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="text-slate-500 text-sm">Sacramentos cargados</span>
                                <span className="font-mono font-bold text-slate-900">{appData.data?.sacraments?.length || 0}</span>
                            </div>
                             <div className="flex justify-between pt-1">
                                <span className="text-slate-500 text-sm">Carga de autenticación</span>
                                <span className="font-mono text-slate-900">{auth.loading ? 'Sí' : 'No'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Diagnóstico técnico JSON */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="flex flex-col h-[500px]">
                         <div className="bg-slate-800 text-slate-300 px-4 py-2 rounded-t-lg flex items-center gap-2 border-b border-slate-700">
                            <Lock className="w-4 h-4" />
                            <span className="text-sm font-mono font-bold">AuthContext.user · JSON bruto</span>
                        </div>
                        <div className="bg-slate-900 text-green-400 p-4 rounded-b-lg shadow-lg overflow-auto flex-1 border border-slate-800">
                            <pre className="text-xs font-mono leading-relaxed">
                                {JSON.stringify(user, null, 2)}
                            </pre>
                        </div>
                    </div>

                    <div className="flex flex-col h-[500px]">
                        <div className="bg-slate-800 text-slate-300 px-4 py-2 rounded-t-lg flex items-center gap-2 border-b border-slate-700">
                            <Database className="w-4 h-4" />
                            <span className="text-sm font-mono font-bold">AppDataContext.data · estructura y conteos</span>
                        </div>
                        <div className="bg-slate-900 text-blue-400 p-4 rounded-b-lg shadow-lg overflow-auto flex-1 border border-slate-800">
                             <pre className="text-xs font-mono leading-relaxed">
                                {JSON.stringify({
                                    usersCount: appData.data?.users?.length,
                                    parishesCount: appData.data?.parishes?.length,
                                    diocesesCount: appData.data?.dioceses?.length,
                                    sampleUser: appData.data?.users?.[0] || 'Sin usuarios',
                                    currentUserFromAppData: appData.user,
                                    localStorageKeys: Object.keys(localStorage)
                                }, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebugAuthPage;