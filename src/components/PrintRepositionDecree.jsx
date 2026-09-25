import React, { forwardRef, useState, useEffect } from 'react';
import { convertDateToSpanishTextNatural } from '@/utils/dateTimeFormatters';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';

const PrintRepositionDecree = forwardRef(({ decreeData }, ref) => {
  const { getMisDatosList } = useAppData();
  const { user: authUser } = useAuth();

  const [chanceryData, setChanceryData] = useState({});
  const [targetParishInfo, setTargetParishInfo] = useState({ name: '', city: '' });

  useEffect(() => {
      let isMounted = true;

      const fetchDataFromCloud = async () => {
          try {
              // 1. BUSCAR DATOS EXACTOS DE LA CANCILLERÍA
              let chanceryIdToUse = authUser?.chanceryId || authUser?.chancery_id;

              if (!chanceryIdToUse) {
                  let dioceseId = authUser?.dioceseId || authUser?.diocese_id;
                  
                  if (!dioceseId && authUser?.parishId) {
                      const { data: pData } = await supabase.from('parishes').select('diocese_id').eq('id', authUser.parishId).single();
                      if (pData) dioceseId = pData.diocese_id;
                  }

                  if (dioceseId) {
                      const { data: chanceryRecord } = await supabase.from('chancelleries').select('id').eq('diocese_id', dioceseId).maybeSingle();
                      if (chanceryRecord) chanceryIdToUse = chanceryRecord.id;
                  }
              }

              if (chanceryIdToUse) {
                  const { data: misDatosCancilleria } = await supabase.from('mis_datos').select('payload').eq('entity_id', chanceryIdToUse).maybeSingle();

                  if (misDatosCancilleria && misDatosCancilleria.payload && isMounted) {
                      let p = misDatosCancilleria.payload;
                      if (typeof p === 'string') p = JSON.parse(p);
                      if (Array.isArray(p)) p = p[0];
                      setChanceryData(p || {});
                  }
              }

              // 2. BUSCAR DATOS DE LA PARROQUIA DESTINO
              let pId = decreeData?.targetParishId || decreeData?.parish_id || authUser?.parishId;

              if (pId) {
                  const { data: parishMisDatos } = await supabase.from('mis_datos').select('payload').eq('entity_id', pId).maybeSingle();
                  let pName = ''; let pCity = '';
                  
                  if (parishMisDatos && parishMisDatos.payload) {
                      let p = parishMisDatos.payload;
                      if (typeof p === 'string') p = JSON.parse(p);
                      if (Array.isArray(p)) p = p[0]; p = p || {};
                      pName = p.nombre || ''; pCity = p.ciudad || '';
                  }

                  if (isMounted) {
                      setTargetParishInfo({ name: pName.toUpperCase(), city: pCity.toUpperCase() });
                  }
              }
          } catch (err) {
              console.error("Error buscando datos en Supabase:", err);
          }
      };

      if (decreeData) fetchDataFromCloud();
      return () => { isMounted = false; };
  }, [authUser, decreeData]);

  if (!decreeData) return null;

  const {
    decreeNumber, numeroDecreto, decreeDate, fechaDecreto, targetName,
    newPartidaSummary = {}, datosNuevaPartida = {}, concepto, causa
  } = decreeData;

  const misDatosList = authUser?.parishId ? getMisDatosList(authUser.parishId) : [];
  const misDatosParroquia = misDatosList[0] || {}; 

  const orgData = {
    name: chanceryData.nombreCancilleria || chanceryData.nombre || 'OFICINA DE DOCUMENTOS DE CANCILLERÍA',
    address: chanceryData.direccion || '[Dirección no configurada]',
    phone: chanceryData.telefono || '[Teléfono no configurado]',
    city: chanceryData.ciudad || authUser?.city || '[Ciudad no configurada]',
    email: chanceryData.email || '[Email no configurado]'
  };

  const diocesisName = (decreeData.dioceseName || decreeData.diocese_name || decreeData.jurisdictionName || decreeData.jurisdiction_name || chanceryData.nombreDiocesis || chanceryData.diocesis || chanceryData.jurisdiccion || authUser?.dioceseName || authUser?.diocese_name || 'JURISDICCIÓN ECLESIÁSTICA').toUpperCase();
  const jurisdictionKind = diocesisName.includes('ARQUIDIÓCESIS') ? 'Arquidiócesis' : diocesisName.includes('DIÓCESIS') ? 'Diócesis' : 'jurisdicción eclesiástica';
  const cancillerName = (decreeData.cancillerName || decreeData.chancellorName || chanceryData.canciller || chanceryData.nombreCanciller || chanceryData.nombreSacerdote || '[CANCILLER NO CONFIGURADO]').toUpperCase();
  const cargoName = (decreeData.cancillerCargo || decreeData.chancellorTitle || chanceryData.cargo || 'CANCILLER DIOCESANO').toUpperCase();

  const parroquiaNombre = targetParishInfo.name || misDatosParroquia.nombre || authUser?.parishName || '[PARROQUIA NO CONFIGURADA]';
  const ciudadParroquia = targetParishInfo.city || misDatosParroquia.ciudad || authUser?.city || '[CIUDAD NO CONFIGURADA]';

  // 🚀 BUSCADOR INTELIGENTE DE VALORES
  const getVal = (key) => datosNuevaPartida[key] || decreeData[key] || newPartidaSummary[key] || '';

  const getFormattedSex = (val) => {
      const s = String(val || '').toUpperCase();
      if (s === '1' || s.includes('MASC')) return 'MASCULINO';
      if (s === '2' || s.includes('FEM')) return 'FEMENINO';
      return '---';
  };

  const getFormattedUnion = (val) => {
      const u = String(val || '').toUpperCase();
      if (u === '1' || u.includes('CATÓLICO') || u.includes('CATOLICO')) return 'MATRIMONIO CATÓLICO';
      if (u === '2' || u.includes('CIVIL')) return 'MATRIMONIO CIVIL';
      if (u === '3' || u.includes('LIBRE')) return 'UNIÓN LIBRE';
      if (u === '4' || u.includes('SOLTERA')) return 'MADRE SOLTERA';
      if (u === '5') return 'OTRO CASO';
      return u || '---';
  };

  // EVITA EL ERROR DE "0---" Rellenando solo si el valor es válido
  const pad = (val) => val && String(val).trim() !== '' && val !== '---' ? String(val).padStart(4, '0') : '----';

  const baptismRecord = {
    book: pad(getVal('book') || getVal('book_number') || getVal('numeroLibro') || getVal('Libro')),
    page: pad(getVal('page') || getVal('page_number') || getVal('folio')),
    entry: pad(getVal('entry') || getVal('entry_number') || getVal('numero') || getVal('numeroActa')),
    sacramentDate: getVal('sacramentDate') || getVal('fechaSacramento') || getVal('fecbau') || '---',
    firstName: (getVal('firstName') || getVal('nombres') || '').toUpperCase(),
    lastName: (getVal('lastName') || getVal('apellidos') || '').toUpperCase(),
    birthDate: getVal('birthDate') || getVal('fechaNacimiento') || getVal('fecnac') || '---',
    birthPlace: (getVal('placeOfBirth') || getVal('lugarNacimiento') || getVal('lugarNacimientoDetalle') || getVal('lugarn') || '---').toUpperCase(),
    father: (getVal('fatherName') || getVal('nombrePadre') || getVal('padre') || '---').toUpperCase(),
    mother: (getVal('motherName') || getVal('nombreMadre') || getVal('madre') || '---').toUpperCase(),
    sex: getFormattedSex(getVal('sex') || getVal('sexo')),
    unionType: getFormattedUnion(getVal('tipoUnionPadres') || getVal('tipohijo')),
    paternalGrandparents: (getVal('paternalGrandparents') || getVal('abuelosPaternos') || getVal('abuepat') || '---').toUpperCase(),
    maternalGrandparents: (getVal('maternalGrandparents') || getVal('abuelosMaternos') || getVal('abuemat') || '---').toUpperCase(),
    godparents: (getVal('godparents') || getVal('padrinos') || '---').toUpperCase(),
    minister: (getVal('minister') || getVal('ministro') || '---').toUpperCase(),
    daFe: (getVal('ministerFaith') || getVal('daFe') || getVal('da_fe') || '---').toUpperCase(),
  };

  const sacramentType = String(decreeData.sacramentType || decreeData.sacrament || decreeData.sacramento || 'bautismo').toLowerCase();
  const isConfirmation = sacramentType === 'confirmacion' || sacramentType === 'confirmation';
  const sacramentName = isConfirmation ? 'CONFIRMACIÓN' : 'BAUTISMO';
  const fullNameSubject = targetName?.toUpperCase() || `${baptismRecord.firstName} ${baptismRecord.lastName}`.trim() || '---';
  const finalDecreeNumber = decreeNumber || numeroDecreto || '---';
  const finalDecreeDate = decreeDate || fechaDecreto;
  const causaReposicion = (causa || concepto || '[CAUSA NO CONFIGURADA]').toUpperCase();
  const emissionDateText = finalDecreeDate ? convertDateToSpanishTextNatural(finalDecreeDate) : '---';

  const DataRow = ({ label, value, bold }) => (
    <div className="flex items-end mb-[2px]">
      <span className="font-semibold text-black uppercase tracking-wider text-[8pt] w-36 shrink-0">{label}:</span>
      <span className={`font-mono flex-1 border-b border-dotted border-slate-500 pl-2 uppercase text-[8.5pt] leading-tight text-black ${bold ? 'font-bold' : ''}`}>
        {value || '\u00A0'}
      </span>
    </div>
  );

  return (
    <div id="printable-content" ref={ref} className="bg-white text-black font-serif mx-auto box-border flex flex-col justify-between p-8 min-h-[279.4mm] w-[215.9mm] shadow-xl print:shadow-none print:p-0 print:m-0 print:w-[215.9mm] print:h-[279.4mm] print:overflow-hidden">
      <style>{`
        @media print {
          @page { margin: 0; size: letter; }
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
          body * { visibility: hidden; }
          #printable-content, #printable-content * { visibility: visible; }
          #printable-content { position: absolute; left: 0; top: 0; width: 215.9mm; height: 279.4mm; padding: 10mm 15mm !important; box-sizing: border-box; display: flex !important; flex-direction: column !important; justify-content: space-between !important; }
        }
      `}</style>

      {/* --- BLOQUE SUPERIOR --- */}
      <div className="w-full flex-1 flex flex-col">
          
          <div className="text-center mb-3 relative border-b border-black pb-2 shrink-0">
            <h1 className="text-[12pt] font-extrabold uppercase tracking-widest mb-0.5 text-black">{diocesisName}</h1>
            <h2 className="text-[9pt] font-semibold uppercase tracking-widest text-black">Oficina de Cancillería</h2>
            <div className="mt-2 inline-block border-2 border-black px-3 py-1 bg-slate-50 print:bg-slate-100">
               <span className="font-bold uppercase tracking-wider text-[10pt] text-black">Decreto de Reposición de Partida</span>
            </div>
            <div className="absolute right-0 top-0 text-[6pt] font-mono text-black font-bold text-right leading-tight">
              CÓDIGO: CAL-ODC-022<br/>VERSIÓN: 001
            </div>
          </div>

          <div className="flex justify-between items-end mb-3 shrink-0">
            <div className="w-2/3 text-justify text-[9.5pt] pr-4 text-black">
               <p>Al Señor Cura Párroco de la Parroquia <strong>{parroquiaNombre}</strong>, de <span className="uppercase font-semibold">{ciudadParroquia}</span>.</p>
            </div>
            <div className="w-1/3 text-right border-2 border-black p-1.5 bg-slate-50 print:bg-slate-100">
              <div className="font-bold text-[6.5pt] uppercase tracking-widest text-black">Decreto Número</div>
              <div className="font-mono text-lg font-bold tracking-wider text-black leading-none my-1">{finalDecreeNumber}</div>
              <div className="font-bold text-[6.5pt] uppercase tracking-widest text-black border-t border-black pt-0.5">Fecha de Emisión</div>
              <div className="font-mono text-[7.5pt] uppercase font-semibold text-black">{emissionDateText}</div>
            </div>
          </div>

          <div className="mb-2 text-[9pt] text-black shrink-0">
            <p className="text-justify leading-snug">
              Por el presente documento, ante la comprobación de que no existe una partida original utilizable, según la causa documentada: <strong>{causaReposicion}</strong>, el Gobierno de la {jurisdictionKind}, en uso de sus facultades, <strong>AUTORIZA Y ORDENA</strong> asentar una <strong>PARTIDA SUPLETORIA DE {sacramentName}</strong> a nombre de:
            </p>
            <div className="text-center mt-1">
                <span className="font-bold text-[11pt] text-black uppercase tracking-wider border-b border-black inline-block min-w-[70%] pb-0.5">{fullNameSubject}</span>
            </div>
          </div>

          <div className="mb-2 border-t-2 border-black pt-2 relative mt-2 flex-1 flex flex-col">
            <div className="text-center font-bold text-[8pt] tracking-widest uppercase text-black mb-2">
              Detalles a Asentar en el Libro Supletorio
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-2 border border-black pb-1.5 pt-1.5 bg-white p-1.5 rounded shrink-0">
              <div className="text-center"><span className="text-[6.5pt] font-bold text-black uppercase block tracking-wider">Libro Supletorio</span><span className="font-mono font-bold text-[10pt] text-black">{baptismRecord.book}</span></div>
              <div className="text-center border-l border-r border-black"><span className="text-[6.5pt] font-bold text-black uppercase block tracking-wider">Folio</span><span className="font-mono font-bold text-[10pt] text-black">{baptismRecord.page}</span></div>
              <div className="text-center"><span className="text-[6.5pt] font-bold text-black uppercase block tracking-wider">Número</span><span className="font-mono font-bold text-[10pt] text-black">{baptismRecord.entry}</span></div>
            </div>

            <div className="flex flex-col flex-1 justify-between pt-1">
              <DataRow label={isConfirmation ? "Fecha de Confirmación" : "Fecha de Bautismo"} value={baptismRecord.sacramentDate} />
              <DataRow label="Nombres" value={baptismRecord.firstName} bold />
              <DataRow label="Apellidos" value={baptismRecord.lastName} bold />
              <DataRow label="Fecha Nacimiento" value={baptismRecord.birthDate} />
              <DataRow label="Lugar Nacimiento" value={baptismRecord.birthPlace} />
              <DataRow label="Padre" value={baptismRecord.father} />
              <DataRow label="Madre" value={baptismRecord.mother} />
              <div className="flex w-full">
                <div className="w-[55%] flex items-end pr-1">
                    <span className="font-semibold text-black uppercase tracking-wider text-[8pt] w-36 shrink-0">Tipo de Unión:</span>
                    <span className="font-mono flex-1 border-b border-dotted border-slate-500 pl-1 uppercase text-[8.5pt] text-black">{baptismRecord.unionType}</span>
                </div>
                <div className="w-[45%] flex items-end pl-1">
                    <span className="font-semibold text-black uppercase tracking-wider text-[8pt] w-12 shrink-0">Sexo:</span>
                    <span className="font-mono flex-1 border-b border-dotted border-slate-500 pl-1 uppercase text-[8.5pt] text-black">{baptismRecord.sex}</span>
                </div>
              </div>
              <DataRow label="Abuelos Paternos" value={baptismRecord.paternalGrandparents} />
              <DataRow label="Abuelos Maternos" value={baptismRecord.maternalGrandparents} />
              {isConfirmation && <DataRow label="Lugar de Bautismo" value={(getVal('lugarBautismo') || getVal('baptismPlace') || '---').toUpperCase()} />}
              {isConfirmation && <DataRow label="Fecha de Bautismo" value={getVal('fechaBautismo') || getVal('baptismDate') || '---'} />}
              <DataRow label="Padrinos" value={baptismRecord.godparents} />
              <DataRow label="Ministro" value={baptismRecord.minister} />
              <DataRow label="Da Fe" value={baptismRecord.daFe} bold />
            </div>
          </div>

          <div className="mb-2 relative border border-black p-2 bg-slate-50 print:bg-slate-100 mt-2 shrink-0">
             <div className="absolute -top-2.5 left-4 bg-slate-50 print:bg-slate-100 px-2 font-bold text-[7pt] tracking-widest uppercase border border-black border-b-0 text-black">
              Disposición
            </div>
            
            <p className="font-mono text-[8pt] leading-tight text-justify mt-1 text-black font-semibold uppercase">
              CÓPIESE FIELMENTE ESTA INFORMACIÓN EN EL LIBRO SUPLETORIO DE {sacramentName} DE LA PARROQUIA. EL DESPACHO PARROQUIAL DEJARÁ CONSTANCIA DEL ASENTAMIENTO Y CONSERVARÁ EL PRESENTE DECRETO COMO SOPORTE DOCUMENTAL.
            </p>
          </div>

          <p className="text-[7pt] text-black text-justify px-2 leading-tight shrink-0">
            <strong>NOTA IMPORTANTE:</strong> Favor confirmar el recibo del decreto al correo oficial: <strong>{orgData.email}</strong>. El despacho parroquial deberá velar por el resguardo y custodia del nuevo libro de reposición.
          </p>
      </div>

      {/* --- BLOQUE INFERIOR FIJO --- */}
      <div className="w-full shrink-0 pt-2">
          <div className="flex justify-between items-end px-12 mb-3">
            <div className="text-center w-5/12">
              <div className="border-t border-black pt-1 font-bold uppercase text-[8pt] tracking-wide text-black">
                {cancillerName}
              </div>
              <div className="text-[6.5pt] font-bold text-black uppercase tracking-widest mt-0.5">
                 {cargoName}
              </div>
            </div>
            <div className="text-center w-1/3">
              <div className="h-20 w-20 border-2 border-dotted border-black rounded-full mx-auto flex items-center justify-center text-black text-[8px] font-bold uppercase tracking-widest text-center leading-tight p-1">
                Sello<br/>Cancillería
              </div>
            </div>
          </div>

          <div className="w-full text-center text-[7pt] text-black border-t border-black pt-1.5">
            <p className="font-extrabold uppercase tracking-widest mb-0.5">{orgData.name}</p>
            <p className="font-medium">{orgData.address} • Tel: {orgData.phone} • E-mail: {orgData.email}</p>
            <p className="font-bold mt-1 tracking-widest uppercase">{orgData.city} — COLOMBIA</p>
          </div>
      </div>

    </div>
  );
});

PrintRepositionDecree.displayName = 'PrintRepositionDecree';
export default PrintRepositionDecree;