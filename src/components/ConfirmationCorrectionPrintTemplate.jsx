import React, { forwardRef } from 'react';
import { getLocalDateISO } from '@/utils/localDate';
import { 
    convertDateToSpanishText, 
    convertNumberToSpanishWords,
    convertMonthToSpanishWords,
    convertYearToSpanishWords 
} from '@/utils/dateTimeFormatters';

const ConfirmationCorrectionPrintTemplate = forwardRef((props, ref) => {
    const {
        decreeNumber,
        decreeDate,
        originalPartidaSummary = {},
        newPartidaSummary = {},
        parroquiaInfo = {},
        cancillerNombre = '',
        parroquiaNombre = '',
        ciudad = ''
    } = props.data || {};

    const getVal = (obj, ...keys) => {
        if (!obj) return '';
        for (let key of keys) {
            if (obj[key] && String(obj[key]).trim() !== '') {
                return String(obj[key]).toUpperCase().trim();
            }
        }
        return '';
    };

    const formatName = (obj) => {
        const first = getVal(obj, 'firstName', 'nombres', 'first_name', 'nombre');
        const last = getVal(obj, 'lastName', 'apellidos', 'last_name', 'apellido');
        const fullName = `${first} ${last}`.trim();
        return fullName || '---';
    };

    // --- DATOS ORIGINALES ---
    const original = {
        name: formatName(originalPartidaSummary),
        book: getVal(originalPartidaSummary, 'book', 'book_number', 'numeroLibro', 'libro') || '---',
        page: getVal(originalPartidaSummary, 'page', 'page_number', 'folio') || '---',
        entry: getVal(originalPartidaSummary, 'entry', 'entry_number', 'numeroActa', 'acta', 'numero') || '---'
    };

    // --- DATOS CORREGIDOS (NUEVOS - Limpios para Confirmación) ---
    const nuevo = {
        name: formatName(newPartidaSummary),
        book: getVal(newPartidaSummary, 'book', 'book_number', 'numeroLibro', 'libro') || '---',
        page: getVal(newPartidaSummary, 'page', 'page_number', 'folio') || '---',
        entry: getVal(newPartidaSummary, 'entry', 'entry_number', 'numeroActa', 'acta', 'numero') || '---',
        padre: getVal(newPartidaSummary, 'fatherName', 'nombrePadre', 'padre') || '---',
        madre: getVal(newPartidaSummary, 'motherName', 'nombreMadre', 'madre') || '---',
        nacimiento: getVal(newPartidaSummary, 'birthDate', 'fechaNacimiento') || '---',
        confirmacion: getVal(newPartidaSummary, 'sacramentDate', 'fechaSacramento', 'fechaConfirmacion') || '---',
        lugarBautismo: getVal(newPartidaSummary, 'lugarBautismo', 'baptismPlace', 'LUGBAU') || '---'
    };

    const formatDateText = (dateStr) => {
        if (!dateStr || dateStr === '---') return '---';
        try {
            const date = new Date(dateStr);
            const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
            
            const day = convertNumberToSpanishWords(localDate.getDate());
            const month = convertMonthToSpanishWords(localDate.getMonth() + 1);
            const year = convertYearToSpanishWords(localDate.getFullYear());
            return `${day} días del mes de ${month} del año ${year}`.toUpperCase();
        } catch (e) {
            return String(dateStr).toUpperCase();
        }
    };

    const currentDateText = formatDateText(decreeDate || getLocalDateISO());

    const styles = {
        page: {
            width: '8.5in', minHeight: '11in', padding: '1in',
            fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt',
            lineHeight: '1.5', color: '#000', backgroundColor: '#fff',
            boxSizing: 'border-box', margin: '0 auto'
        },
        header: { textAlign: 'center', marginBottom: '30px', textTransform: 'uppercase', fontWeight: 'bold' },
        title: { textAlign: 'center', fontWeight: 'bold', marginTop: '20px', marginBottom: '30px', textTransform: 'uppercase' },
        body: { textAlign: 'justify', marginBottom: '20px' },
        decreeSection: { marginBottom: '20px' },
        article: { marginBottom: '15px', textIndent: '30px' },
        footer: { marginTop: '50px', textAlign: 'center' },
        signature: { marginTop: '80px', textAlign: 'center', borderTop: '1px solid #000', width: '60%', marginLeft: 'auto', marginRight: 'auto', paddingTop: '10px' }
    };

    return (
        <div ref={ref} style={styles.page}>
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page { size: letter portrait; margin: 0; }
                    body { margin: 0; background: white; -webkit-print-color-adjust: exact; }
                }
            `}} />

            <div style={styles.header}>
                <div>GOBIERNO DE LA ARQUIDIÓCESIS</div>
                <div>OFICINA DE CANCILLERÍA</div>
                <div>PARROQUIA DESTINO: {String(parroquiaNombre || '[PARROQUIA NO CONFIGURADA]').toUpperCase()}</div>
                <div>{String(ciudad || '[CIUDAD NO CONFIGURADA]').toUpperCase()}</div>
            </div>

            <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '20px' }}>
                DECRETO No. {decreeNumber || '---'}
            </div>

            <div style={styles.title}>
                POR MEDIO DEL CUAL SE CORRIGE UNA PARTIDA DE CONFIRMACIÓN
            </div>

            <div style={styles.body}>
                <p>
                    LA OFICINA DE CANCILLERÍA DE LA ARQUIDIÓCESIS, en ejercicio de la autoridad competente para la corrección registral sacramental, y
                </p>

                <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '20px 0' }}>CONSIDERANDO:</div>

                <p>
                    Que se ha presentado solicitud para corregir la partida de Confirmación correspondiente a <strong>{original.name}</strong>, la cual se encuentra registrada en el Libro {original.book}, Folio {original.page}, Acta {original.entry} de esta Parroquia.
                </p>
                <p>
                    Que analizados los documentos probatorios presentados, se ha verificado que existen errores en la partida original que ameritan ser subsanados para que el registro concuerde con la realidad jurídica y canónica del confirmado.
                </p>

                <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '20px 0' }}>DECRETA:</div>
            </div>

            <div style={styles.decreeSection}>
                <div style={styles.article}>
                    <strong>ARTÍCULO PRIMERO:</strong> Anúlese la Partida de Confirmación registrada en el Libro {original.book}, Folio {original.page}, Número {original.entry}, correspondiente a <strong>{original.name}</strong>.
                </div>
                <div style={styles.article}>
                    <strong>ARTÍCULO SEGUNDO:</strong> Inscríbase en el Libro Supletorio de Confirmaciones una nueva partida con los siguientes datos corregidos:
                    <ul style={{ listStyle: 'none', paddingLeft: '20px', marginTop: '10px', fontSize: '11pt' }}>
                        <li style={{ marginBottom: '5px' }}><strong>NOMBRE:</strong> {nuevo.name}</li>
                        <li style={{ marginBottom: '5px' }}><strong>PADRES:</strong> {nuevo.padre} Y {nuevo.madre}</li>
                        <li style={{ marginBottom: '5px' }}><strong>LUGAR BAUTISMO:</strong> {nuevo.lugarBautismo}</li>
                        <li style={{ marginBottom: '5px' }}><strong>FECHA NACIMIENTO:</strong> {nuevo.nacimiento}</li>
                        <li style={{ marginBottom: '5px' }}><strong>FECHA CONFIRMACIÓN:</strong> {nuevo.confirmacion}</li>
                    </ul>
                </div>
                <div style={styles.article}>
                    <strong>ARTÍCULO TERCERO:</strong> Colóquese la respectiva nota marginal de corrección en la partida original, haciendo referencia al presente Decreto.
                </div>
            </div>

            <div style={{ marginTop: '40px' }}>
                <p>
                    Dado en {String(ciudad || 'LA PARROQUIA').toUpperCase()} a los {currentDateText}.
                </p>
            </div>

            <div style={styles.footer}>
                <div style={{ display: 'inline-block', width: '45%', verticalAlign: 'top', marginTop: '60px' }}>
                    <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto', paddingTop: '5px' }}>
                        <strong style={{textTransform: 'uppercase'}}>{cancillerNombre || '[CANCILLER NO CONFIGURADO]'}</strong><br />
                        CANCILLER
                    </div>
                </div>
                <div style={{ display: 'inline-block', width: '45%', verticalAlign: 'top', marginTop: '60px' }}>
                    <div style={{ borderTop: '1px solid black', width: '80%', margin: '0 auto', paddingTop: '5px' }}>
                        <strong>NOTARIO / SECRETARIO(A)</strong><br />
                        DOY FE
                    </div>
                </div>
            </div>

            <div style={{ position: 'absolute', bottom: '0.8in', left: '0', right: '0', textAlign: 'center', fontSize: '9pt', color: '#555', borderTop: '1px solid #eee', paddingTop: '10px', width: '6.5in', margin: '0 auto' }}>
                {parroquiaInfo.direccion && <span>{String(parroquiaInfo.direccion).toUpperCase()}</span>}
                {parroquiaInfo.telefono && <span> • TEL: {parroquiaInfo.telefono}</span>}
                {parroquiaInfo.email && <span> • EMAIL: {String(parroquiaInfo.email).toUpperCase()}</span>}
            </div>
        </div>
    );
});

ConfirmationCorrectionPrintTemplate.displayName = 'ConfirmationCorrectionPrintTemplate';
export default ConfirmationCorrectionPrintTemplate;
