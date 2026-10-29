import React from 'react';
import {useSearchParams,Link} from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import {useAuth} from '@/context/AuthContext';
import ChanceryDecreeIssueV280 from '@/components/chancery/ChanceryDecreeIssueV280';

/**
 * V285: única vía para expedir decretos nuevos.
 * Esta pantalla no calcula, previsualiza ni asigna Libro/Folio/Número.
 * El asiento pertenece a la bandeja de la parroquia destinataria.
 * Las rutas antiguas continúan funcionando, sin ejecutar las RPC anteriores
 * que creaban una partida antes de la aceptación parroquial.
 */
export default function DecreeIssueRouteV285({sacrament='bautismo',type}){
  const {user}=useAuth();
  const [params]=useSearchParams();
  const initialType=type||(params.get('mode')==='reposition'?'reposicion':'correccion');
  return <DashboardLayout entityName={user?.dioceseName||'Cancillería'}>
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <Link to="/chancery/decretos" className="inline-flex text-xs font-bold text-blue-700 hover:underline">
        Volver al Centro de Decretos
      </Link>
      <ChanceryDecreeIssueV280 key={sacrament+initialType}
        initialSacrament={sacrament} initialType={initialType}/>
    </div>
  </DashboardLayout>;
}
