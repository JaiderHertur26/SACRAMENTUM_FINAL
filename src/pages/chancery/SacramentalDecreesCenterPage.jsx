import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';
import { useSearchParams } from 'react-router-dom';
import ChanceryDecreeInstitutionalManagementPage from './ChanceryDecreeInstitutionalManagementPage';
import RepetitionDecreeWorkflowPage from '@/pages/RepetitionDecreeWorkflowPage';

/**
 * Entrada única al Centro de Decretos. Las operaciones institucionales
 * complementarias tienen una ruta independiente; no se montan aquí ni
 * disparan consultas al entrar al centro.
 */
const SacramentalDecreesCenterPage = () => {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const view = params.get('view');

  // Misma ruta ya autorizada en App.jsx: la gestión especializada se
  // presenta separadamente sin alterar el contrato de autenticación.
  if (view === 'gestion-institucional') return <ChanceryDecreeInstitutionalManagementPage />;
  if (view === 'repeticion') return <RepetitionDecreeWorkflowPage scope="chancery" />;

  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <main className="mx-auto w-full max-w-7xl pb-12">
        <DecreeCenterHeader showCenterButton={false} selectionOnly />
      </main>
    </DashboardLayout>
  );
};

export default SacramentalDecreesCenterPage;
