import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import {
  Church,
  User,
  MapPin,
  Map,
  Landmark,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { generateActivationToken } from '@/lib/activationTokens';

const INITIAL_FORM = {
  name: '',
  city: '',
  type: 'diocese',
  bishop: '',
  auxiliaryBishop: '',
  provinciaEclesiastica: '',
  jurisdiccionEclesiastica: '',
};

const CreateDioceseModal = ({
  isOpen,
  onClose,
  onTokenCreated,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const resetModal = () => {
    setGeneratedCode(null);
    setFormData(INITIAL_FORM);
    setIsGenerating(false);
    onClose?.();
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copiado',
        description: 'Código de activación copiado al portapapeles.',
        className: 'bg-blue-50 text-blue-800',
      });
    } catch (error) {
      toast({
        title: 'No se pudo copiar',
        description: 'Copia manualmente el código de activación.',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateToken = async (e) => {
    e.preventDefault();

    const cleanData = {
      name: formData.name.trim(),
      city: formData.city.trim(),
      type: formData.type,
      bishop: formData.bishop.trim(),
      auxiliaryBishop: formData.auxiliaryBishop.trim(),
      provinciaEclesiastica: formData.provinciaEclesiastica.trim(),
      jurisdiccionEclesiastica: formData.jurisdiccionEclesiastica.trim(),
    };

    if (
      !cleanData.name ||
      !cleanData.city ||
      !cleanData.bishop ||
      !cleanData.provinciaEclesiastica ||
      !cleanData.jurisdiccionEclesiastica
    ) {
      toast({
        title: 'Datos incompletos',
        description: 'Completa todos los campos obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: 'Sesión no válida',
        description: 'No se pudo identificar al Administrador General autenticado.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      const newToken = generateActivationToken(
        'DIOCESE',
        cleanData.name,
        cleanData.type
      );

      const payloadData = {
        name: cleanData.name,
        type: cleanData.type,
        city: cleanData.city,
        bishop: cleanData.bishop,
        auxiliaryBishop: cleanData.auxiliaryBishop,
        provinciaEclesiastica: cleanData.provinciaEclesiastica,
        jurisdiccionEclesiastica: cleanData.jurisdiccionEclesiastica,
      };

      const { data: savedToken, error } = await supabase
        .from('pending_tokens')
        .insert([
          {
            token: newToken,
            type: 'DIOCESE',
            payload: payloadData,
            created_by: user.id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setFormData(cleanData);
      setGeneratedCode(newToken);

      onTokenCreated?.({
        id: savedToken.id,
        token: savedToken.token,
        ...savedToken.payload,
        date: new Date(savedToken.created_at).toLocaleDateString(),
      });

      toast({
        title: 'Código creado',
        description: 'La autorización de la nueva jurisdicción fue guardada en Supabase.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error al generar jurisdicción pendiente:', error);

      toast({
        title: 'No se pudo generar el código',
        description:
          error?.message ||
          'Ocurrió un error al guardar la autorización en Supabase.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetModal}
      title={
        generatedCode
          ? '¡Código Maestro Generado!'
          : 'Asignar Nueva Jurisdicción'
      }
    >
      <div className="w-full max-w-md mx-auto p-2">
        <AnimatePresence mode="wait">
          {!generatedCode ? (
            <motion.form
              key="create"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleGenerateToken}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Tipo
                </label>

                <select
                  className="w-full px-4 py-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value,
                    })
                  }
                >
                  <option value="diocese">Diócesis</option>
                  <option value="archdiocese">Arquidiócesis</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Nombre de la Jurisdicción
                </label>

                <div className="relative">
                  <Church className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                  <input
                    type="text"
                    required
                    className="w-full pl-11 pr-4 py-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                    placeholder="Ej: Arquidiócesis de [Ciudad]"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Ciudad Principal
                </label>

                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                  <input
                    type="text"
                    required
                    className="w-full pl-11 pr-4 py-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                    placeholder="Ej: Barranquilla"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        city: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Provincia Eclesiástica
                  </label>

                  <div className="relative">
                    <Map className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />

                    <input
                      type="text"
                      required
                      className="w-full pl-9 pr-3 py-3 border border-slate-200 bg-white rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-xs font-bold"
                      placeholder="Ej: Barranquilla"
                      value={formData.provinciaEclesiastica}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          provinciaEclesiastica: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Jurisdicción Eclesiástica
                  </label>

                  <div className="relative">
                    <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />

                    <input
                      type="text"
                      required
                      className="w-full pl-9 pr-3 py-3 border border-slate-200 bg-white rounded-xl focus:ring-2 focus:ring-[#D4AF37] outline-none text-xs font-bold"
                      placeholder="Ej: Metropolitana"
                      value={formData.jurisdiccionEclesiastica}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          jurisdiccionEclesiastica: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Obispo / Arzobispo Titular
                </label>

                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                  <input
                    type="text"
                    required
                    className="w-full pl-11 pr-4 py-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                    placeholder="Ej: Mons. Nombre Apellido"
                    value={formData.bishop}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bishop: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Obispo Auxiliar (Opcional)
                </label>

                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                  <input
                    type="text"
                    className="w-full pl-11 pr-4 py-3.5 border border-slate-200 bg-slate-50 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#D4AF37] outline-none font-bold text-sm transition-all"
                    placeholder="Ej: Mons. Nombre Apellido"
                    value={formData.auxiliaryBishop}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        auxiliaryBishop: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetModal}
                  disabled={isGenerating}
                  className="w-1/3 py-6 rounded-xl font-black uppercase text-[10px] tracking-widest"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={isGenerating}
                  className="w-2/3 py-6 rounded-xl bg-[#4B7BA7] hover:bg-[#3A6286] text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/10"
                >
                  {isGenerating
                    ? 'Enviando a la nube...'
                    : 'Generar Código'}
                </Button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-6 text-center space-y-8"
            >
              <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto border border-green-100">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {formData.name}
                </h3>

                <p className="text-slate-500 mt-2 text-sm font-medium">
                  La autorización fue guardada en Supabase. Envía este
                  código al futuro Administrador Diocesano para completar
                  la activación de la jurisdicción.
                </p>
              </div>

              <div className="bg-slate-50 p-8 rounded-2xl border-2 border-dashed border-[#D4AF37] relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-4 text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] rounded-full border border-[#D4AF37]">
                  Código de Activación
                </span>

                <p className="text-4xl font-mono font-black text-[#2C3E50] tracking-widest break-all">
                  {generatedCode}
                </p>
              </div>

              <div className="pt-6 flex flex-col gap-3 border-t border-slate-100">
                <Button
                  type="button"
                  onClick={() => copyToClipboard(generatedCode)}
                  className="w-full py-6 rounded-xl bg-[#D4AF37] hover:bg-[#B4932A] text-slate-900 font-black uppercase tracking-widest text-[10px] shadow-lg"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Código
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={resetModal}
                  className="w-full py-6 rounded-xl font-black uppercase tracking-widest text-[10px]"
                >
                  Cerrar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
};

export default CreateDioceseModal;