import React, { forwardRef } from 'react';

const MarriageIndexPrintTemplate = forwardRef((props, ref) => {
  const { data = [], parishInfo = {}, filterBook = null } = props;

  const title = filterBook 
    ? `ÍNDICE DE MATRIMONIOS - LIBRO ${filterBook}`
    : 'ÍNDICE GENERAL DE MATRIMONIOS';

  const {
    nombre = 'PARROQUIA',
    ciudad = 'CIUDAD',
    diocesis = 'DIÓCESIS'
  } = parishInfo;

  const styles = {
    page: {
      width: '100%',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '11px',
      color: '#000',
    },
    header: {
      textAlign: 'center',
      marginBottom: '20px',
      borderBottom: '2px solid #000',
      paddingBottom: '10px'
    },
    title: {
      fontSize: '16px',
      fontWeight: 'bold',
      margin: '5px 0'
    },
    subtitle: {
      fontSize: '12px',
      fontWeight: 'normal'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '10px'
    },
    th: {
      borderBottom: '1px solid #000',
      textAlign: 'left',
      padding: '4px',
      fontWeight: 'bold'
    },
    td: {
      borderBottom: '1px solid #ddd',
      padding: '4px',
      verticalAlign: 'top'
    },
    footer: {
      marginTop: '30px',
      textAlign: 'center',
      fontSize: '10px',
      color: '#666'
    }
  };

  return (
    <div ref={ref} style={styles.page} className="print-container">
      <style media="print">
        {`
          @page { size: letter; margin: 0.5in; }
          body { margin: 0; }
          .print-container { width: 100%; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        `}
      </style>

      {/* HEADER SECTION - 4 Lines as requested */}
      <div style={{...styles.header, borderBottom: 'none', paddingBottom: '0'}}>
        <div style={{fontSize: '14px', fontWeight: 'bold'}}>{(diocesis || '').toUpperCase()}</div>
        <div style={{fontSize: '14px', fontWeight: 'bold'}}>{(nombre || '').toUpperCase()}</div>
        <div style={{fontSize: '14px', fontWeight: 'bold'}}>{(ciudad || '').toUpperCase()}</div>
        <h2 style={{ ...styles.title, marginTop: '15px' }}>{title}</h2>
        <div style={{ fontSize: '10px', marginTop: '5px' }}>
            Generado el: {new Date().toLocaleDateString()}
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, width: '8%' }}>LIB</th>
            <th style={{ ...styles.th, width: '8%' }}>FOL</th>
            <th style={{ ...styles.th, width: '8%' }}>NUM</th>
            <th style={{ ...styles.th, width: '30%' }}>ESPOSO</th>
            <th style={{ ...styles.th, width: '30%' }}>ESPOSA</th>
            <th style={{ ...styles.th, width: '16%' }}>FECHA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              <td style={styles.td}>{row.book_number || row.libro}</td>
              <td style={styles.td}>{row.page_number || row.folio}</td>
              <td style={styles.td}>{row.entry_number || row.numero}</td>
              <td style={styles.td}>
                <strong>{row.groomSurname}</strong><br/>{row.groomName}
              </td>
              <td style={styles.td}>
                <strong>{row.brideSurname}</strong><br/>{row.brideName}
              </td>
              <td style={styles.td}>
                {row.sacramentDate ? new Date(row.sacramentDate).toLocaleDateString() : '-'}
              </td>
            </tr>
          ))}
          {data.length === 0 && (
              <tr>
                  <td colSpan="6" style={{...styles.td, textAlign: 'center', padding: '20px'}}>No hay registros para mostrar.</td>
              </tr>
          )}
        </tbody>
      </table>

      <div style={styles.footer}>
        Documento generado por SACRAMENTUM · Sistema Eclesial de Registro Sacramental.
      </div>
    </div>
  );
});

MarriageIndexPrintTemplate.displayName = 'MarriageIndexPrintTemplate';
export default MarriageIndexPrintTemplate;