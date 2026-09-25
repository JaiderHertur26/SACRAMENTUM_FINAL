import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Table from '@/components/ui/Table';
import DetailsModal from '@/components/modals/DetailsModal';
import CreateDioceseModal from '@/components/modals/CreateDioceseModal';
import EditDioceseArchdioceseModal from '@/components/modals/EditDioceseArchdioceseModal';
import { Button } from '@/components/ui/button';
import { Eye, Loader2, Search, Plus, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const DioceseListPage = () => {
  const [dioceses, setDioceses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiocese, setSelectedDiocese] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const fetchDiocesesAndUsers = async () => {
      try {
        // Consultamos jurisdicciones y perfiles al mismo tiempo.
        const [dioRes, profRes] = await Promise.all([
          supabase
            .from('dioceses')
            .select('*')
            .order('name', { ascending: true }),

          supabase
            .from('user_profiles')
            .select('*'),
        ]);

        if (dioRes.error) throw dioRes.error;
        if (profRes.error) throw profRes.error;

        // A cada jurisdicción le asociamos únicamente su usuario administrador diocesano.
        const formattedData = (dioRes.data || []).map((d) => {
          const admin = profRes.data?.find(
            (u) => u.diocese_id === d.id && u.role === 'diocese'
          );

          return {
            ...d,
            username: admin
              ? admin.full_name || admin.email || admin.username || 'Sin asignar'
              : 'Sin asignar',
          };
        });

        setDioceses(formattedData);
      } catch (error) {
        console.error('Error al cargar diócesis de la nube:', error);
        setDioceses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiocesesAndUsers();
  }, []);

  const filteredDioceses = dioceses.filter((d) => {
    const term = searchTerm.toLowerCase();

    return (
      (d.name && d.name.toLowerCase().includes(term)) ||
      (d.city && d.city.toLowerCase().includes(term))
    );
  });

  const columns = [
    {
      header: 'Nombre',
      accessor: 'name',
    },
    {
      header: 'Tipo',
      render: (row) => (
        <span
          className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${
            row.type === 'archdiocese'
              ? 'bg-amber-50 text-amber-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {row.type === 'archdiocese' ? 'Arquidiócesis' : 'Diócesis'}
        </span>
      ),
    },
    {
      header: 'Obispo/Arzobispo',
      render: (row) => (
        <span className="font-medium text-slate-700">
          {row.bishop || row.bishop_name || 'No registrado'}
        </span>
      ),
    },
    {
      header: 'Ciudad',
      render: (row) => (
        <span className="font-medium text-slate-600">
          {row.city || '---'}
        </span>
      ),
    },
    {
      header: 'Administrador',
      render: (row) => (
        <span className="font-medium text-slate-600">
          {row.username || 'Sin asignar'}
        </span>
      ),
    },
  ];

  const handleAction = (type, row) => {
    if (type === 'view') {
      setSelectedDiocese(row);
      setIsDetailsModalOpen(true);
    } else if (type === 'edit') {
      setSelectedDiocese(row);
      setIsEditModalOpen(true);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">
            Listado de Jurisdicciones
          </h1>

          <p className="text-slate-500 mt-1 text-xs font-bold uppercase tracking-widest">
            Directorio nacional de diócesis y arquidiócesis
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2 bg-[#D4AF37] hover:bg-[#C4A027] text-[#111111] font-black uppercase tracking-widest text-[10px] whitespace-nowrap shadow-xl shadow-amber-900/10 px-6 py-6 rounded-2xl"
        >
          <Plus className="w-4 h-4" />
          Crear Diócesis/Arquidiócesis
        </Button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
        <div className="flex justify-end mb-6">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

            <input
              type="text"
              placeholder="Buscar jurisdicción..."
              className="w-full pl-11 pr-4 py-3 border border-slate-200 bg-slate-50 rounded-2xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D4AF37] transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-20">
            <Loader2 className="w-10 h-10 text-[#4B7BA7] animate-spin mb-4" />

            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Sincronizando con Supabase...
            </span>
          </div>
        ) : (
          <Table
            columns={columns}
            data={filteredDioceses}
            actions={[
              {
                type: 'view',
                label: (
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>Ver Detalles</span>
                  </div>
                ),
                className:
                  'text-[#4B7BA7] hover:text-[#3A6286] hover:bg-blue-50 font-bold text-xs',
              },
              {
                type: 'edit',
                label: (
                  <div className="flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    <span>Editar</span>
                  </div>
                ),
                className:
                  'text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-bold text-xs',
              },
            ]}
            onAction={handleAction}
            className="border-none"
          />
        )}
      </div>

      <EditDioceseArchdioceseModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        diocese={selectedDiocese}
        onUpdated={(updated) => {
          setDioceses((prev) => prev.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
          setSelectedDiocese((prev) => prev?.id === updated.id ? { ...prev, ...updated } : prev);
        }}
      />

      <CreateDioceseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <DetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        data={selectedDiocese}
      />
    </DashboardLayout>
  );
};

export default DioceseListPage;