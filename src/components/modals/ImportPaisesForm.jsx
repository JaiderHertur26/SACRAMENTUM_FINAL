import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, FileWarning, X } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';

const ImportPaisesForm = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { importPaises, validateJSONStructure } = useAppData();
  const { toast } = useToast();
  
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [jsonContent, setJsonContent] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setPreview(null);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target.result);
            const structureCheck = validateJSONStructure(json);
            if (!structureCheck.isValid) throw new Error(structureCheck.message);

            setJsonContent(json);
            const result = importPaises(json, user?.parishId, true);
            setValidationResult(result);
            setPreview(result.records?.slice(0, 5)); 
        } catch (err) {
            toast({ title: "Error de Validación", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirm = () => {
      if (!jsonContent) return;
      
      setLoading(true);
      const result = importPaises(jsonContent, user?.parishId, false);
      setLoading(false);

      if (result.success) {
           toast({
               title: "Importación Completada",
               description: result.message,
               className: "bg-green-50 border-green-200 text-green-900"
           });
           handleClose();
      } else {
           toast({ title: "Error", description: result.message, variant: "destructive" });
      }
  };

  const handleClose = () => {
      setFile(null); setPreview(null); setValidationResult(null); setJsonContent(null); onClose();
  };

  const columns = [
      { header: 'Nombre', accessor: 'nombre' },
      { header: 'Código', accessor: 'codigo' },
      { header: 'Código ISO', accessor: 'codigoISO' },
      { header: 'Continente', accessor: 'continente' },
  ];

  return (
    <Modal size="lg" isOpen={isOpen} onClose={handleClose} title="Importar Países">
        <div className="space-y-6 w-full">
             <p className="text-slate-900 text-sm">
                Importe el catálogo de Países. Requiere estructura: nombre, codigo. Opcional: codigoISO, continente.
            </p>
            {!preview && (
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                    <input type="file" accept=".json" onChange={handleFileChange} className="hidden" id="country-upload" />
                    <label htmlFor="country-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload className="w-10 h-10 text-[#4B7BA7]" />
                        <span className="text-slate-900 font-bold">Seleccionar archivo JSON</span>
                        <span className="text-xs text-slate-700">Formato: {`{ "data": [...] }`}</span>
                    </label>
                </div>
            )}
            {loading && <div className="text-center text-slate-900 font-medium py-4">Procesando archivo...</div>}

            {validationResult && (
                <div className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1 bg-green-50 p-3 rounded border border-green-200">
                             <div className="text-xs text-green-900 uppercase font-bold">Válidos</div>
                             <div className="text-2xl font-bold text-green-900">{validationResult.count}</div>
                        </div>
                        <div className="flex-1 bg-red-50 p-3 rounded border border-red-200">
                             <div className="text-xs text-red-900 uppercase font-bold">Errores</div>
                             <div className="text-2xl font-bold text-red-900">{validationResult.errors?.length || 0}</div>
                        </div>
                    </div>
                    {preview && preview.length > 0 && (
                         <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <Table columns={columns} data={preview} />
                        </div>
                    )}
                    {validationResult.errors && validationResult.errors.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-3 border border-red-200 max-h-32 overflow-y-auto">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-red-900 mb-2"><FileWarning className="w-4 h-4" /> Alertas</h4>
                            <ul className="list-disc list-inside text-xs text-red-900 space-y-1">
                                {validationResult.errors.slice(0, 10).map((err, idx) => (<li key={idx}>Fila {err.index}: {err.message}</li>))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button variant="outline" onClick={handleClose} className="text-slate-900 border-slate-300"><X className="w-4 h-4 mr-2" /> Cancelar</Button>
                <Button onClick={handleConfirm} disabled={!validationResult || validationResult.count === 0} className="bg-[#D4AF37] hover:bg-[#C4A027] text-white disabled:bg-slate-300"><CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar Importación</Button>
            </div>
        </div>
    </Modal>
  );
};

export default ImportPaisesForm;