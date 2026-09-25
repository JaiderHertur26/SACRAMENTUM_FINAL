import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle2, FileWarning, X } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import Table from '@/components/ui/Table';

const ImportDeathsForm = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { importDeaths, validateJSONStructure } = useAppData();
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
            const result = await importDeaths(json, user?.parishId, true);
            setValidationResult(result);
            setPreview(result.records.slice(0, 3)); 
        } catch (err) {
            toast({ title: "Error de Validación", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirm = async () => {
      if (!jsonContent) return;
      setLoading(true);
      const result = await importDeaths(jsonContent, user?.parishId, false);
      setLoading(false);

      if (result.success) {
           toast({ title: "Importación Completada", description: result.message, className: "bg-green-50 border-green-200" });
           handleClose();
      } else {
           toast({ title: "Error", description: result.message, variant: "destructive" });
      }
  };

  const handleClose = () => {
      setFile(null); setPreview(null); setValidationResult(null); setJsonContent(null); onClose();
  };

  const columns = [
      { header: 'L / F / N', render: (row) => `${row.book_number} / ${row.page_number} / ${row.entry_number}` },
      { header: 'Difunto', render: (row) => `${row.firstName} ${row.lastName}` },
      { header: 'Fecha', accessor: 'sacramentDate' },
  ];

  return (
    <Modal size="lg" isOpen={isOpen} onClose={handleClose} title="Importar Difuntos">
        <div className="space-y-6 w-full">
            {!preview && (
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                    <input type="file" accept=".json" onChange={handleFileChange} className="hidden" id="death-upload" />
                    <label htmlFor="death-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload className="w-10 h-10 text-slate-500" />
                        <span className="text-slate-700 font-medium">Seleccionar archivo JSON</span>
                        <span className="text-xs text-slate-500">Formato: {`{ "data": [...] }`}</span>
                    </label>
                </div>
            )}
            {loading && <div className="text-center text-slate-500">Procesando...</div>}
            {validationResult && (
                <div className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1 bg-green-50 p-3 rounded border border-green-100 text-center">
                             <div className="text-xs text-green-600 font-bold">VÁLIDOS</div>
                             <div className="text-2xl font-bold text-green-800">{validationResult.count}</div>
                        </div>
                        <div className="flex-1 bg-red-50 p-3 rounded border border-red-100 text-center">
                             <div className="text-xs text-red-600 font-bold">ERRORES</div>
                             <div className="text-2xl font-bold text-red-800">{validationResult.errors?.length || 0}</div>
                        </div>
                    </div>
                    {preview && <Table columns={columns} data={preview} />}
                </div>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t">
                <Button variant="outline" onClick={handleClose}><X className="w-4 h-4 mr-2" /> Cancelar</Button>
                <Button onClick={handleConfirm} disabled={!validationResult || validationResult.count === 0} className="bg-slate-700 hover:bg-slate-800 text-white">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar
                </Button>
            </div>
        </div>
    </Modal>
  );
};
export default ImportDeathsForm;