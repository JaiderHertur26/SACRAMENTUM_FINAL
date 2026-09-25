import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { motion } from 'framer-motion';
import { BookOpenCheck, ShieldCheck } from 'lucide-react';

import AnnulmentConceptsTab from './AnnulmentConceptsTab';
import MarginalNotesTab from './MarginalNotesTab';

const AnnulmentConceptsPage = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout entityName={user?.dioceseName || 'Cancillería'}>
      <div className="mx-auto max-w-7xl pb-20">
        <header className="mb-7 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-7 py-7 text-white">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <BookOpenCheck className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.26em] text-amber-300">
                Cancillería · Gobierno Documental
              </p>
              <h1 className="mt-1 font-serif text-3xl font-black text-white">
                Conceptos de Decreto
              </h1>
              <p className="mt-1 text-xs text-slate-300">
                Causas y fundamentos estandarizados para Corrección y Reposición.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-xs text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p>
              La nulidad matrimonial no pertenece a Cancillería. Su conocimiento corresponde
              al Tribunal Eclesiástico y no forma parte de este catálogo.
            </p>
          </div>
        </header>

        <Tabs defaultValue="conceptos" className="w-full">
          <TabsList className="mb-8 grid w-full max-w-lg grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1">
            <TabsTrigger
              value="conceptos"
              className="rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              Causas y fundamentos
            </TabsTrigger>
            <TabsTrigger
              value="notas"
              className="rounded-xl data-[state=active]:bg-slate-900 data-[state=active]:text-white"
            >
              Notas marginales
            </TabsTrigger>
          </TabsList>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <TabsContent value="conceptos">
              <AnnulmentConceptsTab />
            </TabsContent>
            <TabsContent value="notas">
              <MarginalNotesTab />
            </TabsContent>
          </motion.div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AnnulmentConceptsPage;
