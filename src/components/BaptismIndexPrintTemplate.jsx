import React, { forwardRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';
import { formatPersonData } from '@/utils/formatPersonData';

const BaptismIndexPrintTemplate = forwardRef(({ data, parishInfo, bookNumber }, ref) => {
    const { user } = useAuth() || {};
    const { getMisDatosList } = useAppData() || {};
    const dataSource = data || [];

    // --- 1. EXTRACTOR DE IDENTIDAD SEGURO ---
    const getSafeParishId = () => user?.parishId || user?.parish_id || null;
    const safeParishId = getSafeParishId();

    // --- 2. BUSCADOR DEFINITIVO DE MEMBRETE ---
    const getOfficialData = (field, fallback) => {
        try {
            if (parishInfo && parishInfo[field]) return parishInfo[field];

            if (!safeParishId) return fallback;
            let p = null;
            if (typeof getMisDatosList === 'function') {
                const records = getMisDatosList(safeParishId);
                if (records && records.length > 0) p = records[0]['0'] || records[0]; 
            }
            if (!p) return fallback;

            const f = field.toLowerCase();
            const value = p[field] || p[f] || p[field.toUpperCase()] ||
                (f === 'nombre' ? (p.nombre || p.nombreParroquia || p.nombreCancilleria) : null) ||
                (f === 'diocesis' ? (p.diocesis || p.nombreDiocesis || p.diocesis_name) : null) ||
                (f === 'ciudad' ? p.ciudad : null) || (f === 'region' ? p.region : null);

            if (value && String(value).trim() !== '' && String(value).toUpperCase() !== 'DESCONOCIDA') {
                return String(value).trim();
            }
        } catch (e) { console.error("Error leyendo membrete en Índice:", e); }
        return fallback;
    };

    // --- 3. PROCESAMIENTO DE CABECERA OFICIAL ---
    const diocesis = getOfficialData('diocesis', user?.dioceseName || 'DIÓCESIS').toUpperCase();
    const nombreParroquia = getOfficialData('nombre', user?.parishName || 'PARROQUIA').toUpperCase();
    
    const ciudad = getOfficialData('ciudad', '').toUpperCase();
    const departamento = getOfficialData('region', '').toUpperCase();
    
    let ubicacionHeader = [ciudad, departamento].filter(Boolean).join(', ');
    if (ubicacionHeader && !ubicacionHeader.includes('COLOMBIA')) {
        ubicacionHeader += ' - COLOMBIA';
    }

    // --- 4. ORDENAMIENTO ALFABÉTICO ESTRICTO ---
    const sortedData = [...dataSource].sort((a, b) => {
        const nameA = `${a.apellidos || a.raw_data?.apellidos || ''} ${a.nombres || a.raw_data?.nombres || ''}`.trim().toLowerCase();
        const nameB = `${b.apellidos || b.raw_data?.apellidos || ''} ${b.nombres || b.raw_data?.nombres || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // 🚀 SANITIZADOR DE TEXTO (Elimina saltos de línea ocultos)
    const sanitizeText = (val) => {
        if (!val) return '---';
        const str = String(val).replace(/[\r\n]+/g, ' ').trim();
        return str === '' || str === '---' || str === '-' ? '---' : str.toUpperCase();
    };

    const formatNumber = (val) => {
        if (val === undefined || val === null || val === '') return '---';
        const str = String(val).trim();
        if (str === '0' || str === '---' || str === '-') return '---';
        if (isNaN(str)) return str;
        return str.padStart(4, '0');
    };

    const getParentName = (record, type) => {
        const raw = record.raw_data || {};
        let val = '';
        if (type === 'father') {
            val = record.nombre_padre || raw.nombre_padre || raw.nombrePadre || raw.padre || raw.fatherName || raw.father_name;
        } else {
            val = record.nombre_madre || raw.nombre_madre || raw.nombreMadre || raw.madre || raw.motherName || raw.mother_name;
        }
        return sanitizeText(val);
    };

    return (
        <div ref={ref} className="print-container">
            <style type="text/css" media="print, screen">{`
                html, body, #root, .print-container {
                    height: auto !important;
                    min-height: 100% !important;
                    overflow: visible !important;
                    background-color: white !important;
                }

                .print-container {
                    font-family: 'Times New Roman', Times, serif;
                    color: #000;
                    width: 100%;
                    margin: 0;
                    padding: 5mm;
                    box-sizing: border-box;
                }

                /* MÁRGENES FÍSICOS AJUSTADOS PARA QUE QUEPA PERFECTO */
                @page {
                    size: letter portrait;
                    margin: 10mm 12mm 12mm 12mm; 
                }

                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    tr { 
                        page-break-inside: avoid !important; 
                        break-inside: avoid !important;
                    }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                }

                /* MEMBRETE INSTITUCIONAL FIJO AL INICIO */
                .print-header {
                    text-align: center;
                    margin-bottom: 12px;
                    border-bottom: 3px double #000;
                    padding-bottom: 8px;
                }
                .print-diocese {
                    font-size: 11.5pt;
                    font-weight: bold;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }
                .print-parish {
                    font-size: 14.5pt;
                    font-weight: 900;
                    margin: 2px 0;
                    text-transform: uppercase;
                }
                .print-location {
                    font-size: 8.5pt;
                    font-family: 'Arial', sans-serif;
                    color: #222;
                }
                .print-title {
                    font-size: 11pt;
                    font-weight: bold;
                    margin-top: 8px;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                }

                /* 🚀 TABLA PRINCIPAL CON BORDES ANTI-RUPTURAS (SEPARADOS Y MANUALES) */
                .print-table {
                    width: 100%;
                    table-layout: fixed; 
                    border-collapse: separate !important; /* SEPARATE ES LA CLAVE MÁGICA */
                    border-spacing: 0;
                    font-family: 'Arial', sans-serif;
                    font-size: 8pt;
                    border-top: 1.5px solid #000;
                    border-left: 1.5px solid #000;
                }
                
                .header-row th {
                    border-right: 1.5px solid #000;
                    border-bottom: 2px solid #000;
                    padding: 6px 4px;
                    background-color: #eaeaea !important;
                    font-weight: 900;
                    text-align: center;
                    text-transform: uppercase;
                    font-size: 7.5pt;
                    overflow: hidden;
                }
                
                .print-table td {
                    border-right: 1.5px solid #000;
                    border-bottom: 1.5px solid #000;
                    padding: 5px 6px;
                    vertical-align: middle;
                    line-height: 1.15;
                    overflow: hidden;
                    word-wrap: break-word;
                }
                
                .print-table tbody tr:nth-child(even) td {
                    background-color: #f7f7f7 !important;
                }

                /* DISTRIBUCIÓN ESTRICTA DE COLUMNAS */
                .col-number { width: 5%; font-weight: bold; text-align: center; font-size: 7.5pt; }
                .col-titular { width: 33%; }
                .col-padres { width: 43%; font-size: 7.2pt; }
                .col-ref { width: 6.33%; font-family: 'Courier New', Courier, monospace; font-size: 8.5pt; text-align: center; font-weight: bold; white-space: nowrap; }

                .text-bold { font-weight: 900; font-size: 8.5pt; color: #000; }
                .text-muted { font-size: 7.5pt; color: #333; margin-top: 1px; }

                .row-anulada td { color: #555; }
                .badge-anulada {
                    display: inline-block;
                    background-color: #000 !important;
                    color: white !important;
                    font-size: 5pt;
                    padding: 1px 3px;
                    border-radius: 2px;
                    font-weight: bold;
                    margin-left: 4px;
                    vertical-align: text-bottom;
                    letter-spacing: 0.5px;
                }
                
                .footer-cell {
                    border: none !important;
                    background: white !important;
                    padding-top: 10px !important;
                    text-align: right !important;
                    font-size: 6.5pt !important;
                    color: #555 !important;
                    font-style: italic;
                    font-family: 'Times New Roman', Times, serif;
                }
            `}</style>
            
            <div className="print-header">
                <div className="print-diocese">{diocesis}</div>
                <div className="print-parish">{nombreParroquia}</div>
                <div className="print-location">{ubicacionHeader}</div>
                <div className="print-title">
                    ÍNDICE GENERAL DE BAUTISMOS {bookNumber ? `• LIBRO ${bookNumber.padStart(4, '0')}` : ''}
                </div>
            </div>

            <table className="print-table">
                <thead>
                    <tr className="header-row">
                        <th className="col-number">N°</th>
                        <th className="col-titular">APELLIDOS Y NOMBRES</th>
                        <th className="col-padres">PADRES / FILIACIÓN</th>
                        <th className="col-ref">LIBRO</th>
                        <th className="col-ref">FOLIO</th>
                        <th className="col-ref">ACTA</th>
                    </tr>
                </thead>
                
                <tbody>
                    {sortedData.map((record, index) => {
                        const safeFormat = (val) => typeof formatPersonData === 'function' ? formatPersonData(val) : val;

                        const apellidos = sanitizeText(safeFormat(record.apellidos || record.raw_data?.apellidos || record.lastName || ''));
                        const nombres = sanitizeText(safeFormat(record.nombres || record.raw_data?.nombres || record.firstName || ''));
                        
                        const padre = sanitizeText(safeFormat(getParentName(record, 'father')));
                        const madre = sanitizeText(safeFormat(getParentName(record, 'mother')));
                        
                        const book = formatNumber(record.book_number || record.Libro || record.raw_data?.Libro || record.libro);
                        const page = formatNumber(record.folio || record.raw_data?.folio || record.page_number);
                        const entry = formatNumber(record.number || record.numero || record.raw_data?.numero || record.raw_data?.numeroActa);
                        
                        const status = String(record.status || record.raw_data?.status || record.raw_data?.estado || '').toLowerCase();
                        const statusLabel = (['anulada', 'annulled'].includes(status) || record.raw_data?.isAnnulled === true)
                            ? 'ANULADA'
                            : ['reversed', 'revertida'].includes(status)
                                ? 'REVERTIDA'
                                : ['replaced', 'deleted'].includes(status)
                                    ? 'NO VIGENTE'
                                    : '';
                        const isInactive = Boolean(statusLabel);

                        return (
                            <tr key={record.id || index} className={isInactive ? 'row-anulada' : ''}>
                                <td className="col-number">{index + 1}</td>
                                
                                <td>
                                    <div className="text-bold">
                                        {apellidos}
                                        {statusLabel && <span className="badge-anulada">{statusLabel}</span>}
                                    </div>
                                    <div className="text-muted">{nombres}</div>
                                </td>
                                
                                <td className="col-padres">
                                    <div style={{ marginBottom: '1px' }}><strong>P:</strong> {padre}</div>
                                    <div><strong>M:</strong> {madre}</div>
                                </td>
                                
                                <td className="col-ref">{book}</td>
                                <td className="col-ref">{page}</td>
                                <td className="col-ref">{entry}</td>
                            </tr>
                        );
                    })}
                </tbody>

                <tfoot>
                    <tr>
                        <td colSpan="6" className="footer-cell">
                            Índice generado oficialmente por SACRAMENTUM · Sistema Eclesial de Registro Sacramental • {new Date().toLocaleDateString('es-CO')}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
});

BaptismIndexPrintTemplate.displayName = 'BaptismIndexPrintTemplate';
export default BaptismIndexPrintTemplate;