import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FileText, History } from 'lucide-react';
import DecreeCenterHeader from '@/components/chancery/DecreeCenterHeader';
import ChanceryDecreeIssueV280 from '@/components/chancery/ChanceryDecreeIssueV280';
import ChanceryDecreeSeatReceiptsV280 from '@/components/chancery/ChanceryDecreeSeatReceiptsV280';
import NewSupplementaryDecreePanelV271 from '@/components/chancery/NewSupplementaryDecreePanelV271';
import NullityInstitutionalPreflightPanel from '@/components/chancery/NullityInstitutionalPreflightPanel';
import HistoricalDecreeReconciliationPanel from '@/components/chancery/HistoricalDecreeReconciliationPanel';

/** Pantalla separada de gestión especializada, sin saturar el Centro principal. */
const ChanceryDecreeInstitutionalManagementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <main className="mx-auto max-w-7xl space-y-7 pb-20">
        <DecreeCenterHeader
          showBack
          title="Gestión institucional de decretos"
          subtitle="Actuaciones complementarias, constancias, seguimiento jurídico y conciliación de antecedentes."
        />
        <section className="grid gap-4 md:grid-cols-2">
          <button type="button" onClick={() => navigate('/chancery/decretos/documental')}
            className="flex items-start gap-4 rounded-3xl border border-blue-200 bg-blue-50 p-5 text-left transition hover:border-blue-400 hover:bg-blue-100">
            <FileText className="mt-1 h-6 w-6 shrink-0 text-blue-700" />
            <span><strong className="block font-serif text-lg text-slate-950">Decreto documental nuevo</strong>
              <small className="mt-2 block leading-relaxed text-slate-700">Expedir un acto de Cancillería sin alterar partidas ni notas marginales.</small></span>
          </button>
          <button type="button" onClick={() => navigate('/chancery/decretos/documental?mode=historico')}
            className="flex items-start gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-left transition hover:border-amber-400 hover:bg-amber-100">
            <History className="mt-1 h-6 w-6 shrink-0 text-amber-700" />
            <span><strong className="block font-serif text-lg text-slate-950">Recuperar decreto antiguo</strong>
              <small className="mt-2 block leading-relaxed text-slate-700">Archivar su antecedente con fuente verificable, sin repetir efectos ya ocurridos.</small></span>
          </button>
        </section>
        <ChanceryDecreeIssueV280 />
        <ChanceryDecreeSeatReceiptsV280 />
        <NewSupplementaryDecreePanelV271 mode="issue" />
        <NullityInstitutionalPreflightPanel />
        <HistoricalDecreeReconciliationPanel />
      </main>
    </DashboardLayout>
  );
};

export default ChanceryDecreeInstitutionalManagementPage;
