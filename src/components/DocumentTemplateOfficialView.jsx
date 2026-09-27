import React from 'react';
import {
  DOCUMENT_PALETTE,
  DocumentFooter,
  DocumentFrame,
  EcclesialHeader,
  RegistryBand,
  SignatureLine
} from '@/components/sacramental/EcclesialDocumentPrimitives';

const CATEGORY_LABELS = {
  certificate: 'CERTIFICACIÓN ECLESIAL',
  permission: 'LICENCIA / PERMISO ECLESIAL',
  formation_certificate: 'CONSTANCIA DE FORMACIÓN',
  dispensation: 'SOLICITUD / DISPENSA CANÓNICA',
  request: 'SOLICITUD ECLESIAL',
  correction_request: 'SOLICITUD DE CORRECCIÓN',
  replacement_request: 'SOLICITUD DE REPOSICIÓN',
  canonical_declaration: 'DECLARACIÓN CANÓNICA',
  legacy_document: 'DOCUMENTO ECLESIAL'
};

const safe = (value) => String(value ?? '').trim();
const unresolved = (value) => /<[^<>]+>/.test(String(value || ''));

const renderBody = (text) => {
  const blocks = String(text || '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const numbered = lines.length > 1 && lines.every((line) => /^\d+\)/.test(line));

    if (numbered) {
      return (
        <div key={index} style={{ margin: '0 0 15px 22px' }}>
          {lines.map((line, itemIndex) => (
            <div key={itemIndex} style={{ display:'grid', gridTemplateColumns:'24px 1fr', gap:8, marginBottom:7 }}>
              <div style={{ fontWeight:800, color:DOCUMENT_PALETTE.navy }}>{line.match(/^\d+\)/)?.[0]}</div>
              <div style={{ textAlign:'justify' }}>{line.replace(/^\d+\)\s*/, '')}</div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <p
        key={index}
        style={{
          margin: '0 0 15px',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 13.1,
          lineHeight: 1.78,
          textAlign: 'justify',
          color: DOCUMENT_PALETTE.ink,
          whiteSpace: 'pre-wrap'
        }}
      >
        {block}
      </p>
    );
  });
};

const signatureConfiguration = ({ category, values, priestName }) => {
  if (category === 'canonical_declaration') {
    return [
      { name: values?.ParteCatolica, role:'PARTE CATÓLICA' },
      { name: values?.OtraParte, role:'OTRA PARTE' },
      { name: priestName, role:'PÁRROCO / ASISTENTE ECLESIÁSTICO' }
    ];
  }

  if (category === 'request' || category === 'correction_request' || category === 'replacement_request') {
    return [
      { name: values?.Solicitante || values?.Nombre || '', role:'SOLICITANTE' },
      { name: priestName, role:'PÁRROCO / RESPONSABLE DEL DESPACHO' }
    ];
  }

  return [
    { name: priestName, role:'PÁRROCO / SACERDOTE AUTORIZADO' }
  ];
};

export default function DocumentTemplateOfficialView({
  template,
  text,
  values = {},
  dioceseName = '',
  parishName = '',
  city = '',
  priestName = '',
  refProp
}) {
  const category = template?.category || 'document';
  const code = safe(template?.code || template?.legacy_code).replace(/^LEGACY-/i, '');
  const registryBook = values?.Libro || (code === '73031' ? values?.LibroBau : '');
  const registryFolio = values?.Folio || (code === '73031' ? values?.FolioBau : '');
  const registryNumber = values?.Numero || (code === '73031' ? values?.NumeroBau : '');
  const registryItems = [
    registryBook && { label:'Libro', value:registryBook },
    registryFolio && { label:'Folio', value:registryFolio },
    registryNumber && { label:'Número', value:registryNumber }
  ].filter(Boolean);
  const signatures = signatureConfiguration({ category, values, priestName });
  const hasMissing = unresolved(text);

  return (
    <DocumentFrame refProp={refProp} watermark>
      <div style={{ minHeight:'10.08in', display:'flex', flexDirection:'column' }}>
        <EcclesialHeader
          diocese={(dioceseName || values?.Diocesis || values?.Diócesis || '').toUpperCase()}
          parish={(parishName || values?.Miparroquia || values?.MiParroquia || '').toUpperCase()}
          location={(city || values?.Miciudad || values?.MiCiudad || '').toUpperCase()}
          eyebrow={CATEGORY_LABELS[category] || 'DOCUMENTO ECLESIAL'}
          title={template?.name || 'Documento eclesial'}
          subtitle={code ? `Código documental · ${code}` : 'Documento institucional'}
          compact={false}
        />

        {registryItems.length > 0 && (
          <div style={{ margin:'4px 8px 18px' }}>
            <RegistryBand items={registryItems} />
          </div>
        )}

        <div style={{
          flex:1,
          padding:'10px 26px 0',
          display:'flex',
          flexDirection:'column'
        }}>
          <div style={{ flex:1 }}>
            {renderBody(text)}
          </div>

          {hasMissing && (
            <div style={{
              margin:'10px 0 18px',
              border:`1px solid ${DOCUMENT_PALETTE.goldSoft}`,
              background:DOCUMENT_PALETTE.ivory,
              padding:'8px 10px',
              borderRadius:8,
              fontSize:8.4,
              fontWeight:800,
              color:DOCUMENT_PALETTE.warning,
              textAlign:'center',
              letterSpacing:'0.035em'
            }}>
              DOCUMENTO EN PREPARACIÓN · EXISTEN CAMPOS PENDIENTES DE COMPLETAR
            </div>
          )}

          <div style={{
            display:'flex',
            justifyContent: signatures.length === 1 ? 'center' : 'space-around',
            alignItems:'flex-end',
            gap:18,
            margin:'46px 0 28px',
            minHeight:70
          }}>
            {signatures.map((signature, index) => (
              <SignatureLine
                key={`${signature.role}-${index}`}
                name={signature.name}
                role={signature.role}
                width={signatures.length >= 3 ? 190 : 245}
              />
            ))}
          </div>
        </div>

        <DocumentFooter
          trace={`SACRAMENTUM · DOCUMENTO VINCULADO AL REGISTRO ECLESIAL${template?.version ? ` · VERSIÓN ${template.version}` : ''}`}
        />
      </div>
    </DocumentFrame>
  );
}
