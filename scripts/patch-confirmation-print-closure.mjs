import fs from 'node:fs';
import path from 'node:path';
const root='C:/SACRAMENTUM/SACRAMENTUM_FINAL/src';
function rep(file,oldText,newText){
  let s=fs.readFileSync(file,'utf8');
  if(!s.includes(oldText)) throw new Error(`Patrón no encontrado en ${path.basename(file)}: ${oldText.slice(0,90)}`);
  fs.writeFileSync(file,s.replace(oldText,newText),'utf8');
}
const p=`${root}/components/PrintCorrectionDecreeConfirmations.jsx`;
rep(p,"  const cancillerName = chanceryData.canciller || chanceryData.parroco || 'CANCILLER DIOCESANO';","  const cancillerName = chanceryData.canciller || '[CANCILLER NO CONFIGURADO]';");
rep(p,"  let nombreDaFeFinal = targetParishInfo.priest || 'PÁRROCO ENCARGADO';","  let nombreDaFeFinal = '';");
rep(p,"      rawMinistro = rawMinistro !== 'EL PÁRROCO' ? `PBRO. ${rawMinistro}` : rawMinistro;","      // El título y la identidad del ministro deben provenir del registro, no se reconstruyen.");
rep(p,"    daFe: getVal('daFe') || getVal('dafe') || getVal('ministerFaith') || nombreDaFeFinal","    daFe: getVal('daFe') || getVal('dafe') || getVal('ministerFaith') || ''");
rep(p,"  confirmationRecord.sexo = (String(confirmationRecord.sexoRaw) === '1' || String(confirmationRecord.sexoRaw).toUpperCase() === 'MASCULINO' || String(confirmationRecord.sexoRaw).toUpperCase() === 'M') ? 'MASCULINO' : 'FEMENINO';","  const sexoRaw = String(confirmationRecord.sexoRaw || '').toUpperCase().trim();\n  confirmationRecord.sexo = ['1','M','MASCULINO'].includes(sexoRaw) ? 'MASCULINO' : ['2','F','FEMENINO'].includes(sexoRaw) ? 'FEMENINO' : '';" );const q=`${root}/components/ConfirmationCorrectionPrintTemplate.jsx`;
rep(q,"        parrocoNombre = '',","        cancillerNombre = '',");
rep(q,"                <div>GOBIERNO DE LA ARQUIDIÓCESIS</div>\n                <div>PARROQUIA {String(parroquiaNombre || 'SANTO DOMINGO DE GUZMÁN').toUpperCase()}</div>\n                <div>{String(ciudad || 'CIUDAD').toUpperCase()}</div>","                <div>GOBIERNO DE LA ARQUIDIÓCESIS</div>\n                <div>OFICINA DE CANCILLERÍA</div>\n                <div>PARROQUIA DESTINO: {String(parroquiaNombre || '[PARROQUIA NO CONFIGURADA]').toUpperCase()}</div>\n                <div>{String(ciudad || '[CIUDAD NO CONFIGURADA]').toUpperCase()}</div>");
rep(q,"                    EL PÁRROCO DE LA PARROQUIA {String(parroquiaNombre || 'SANTO DOMINGO DE GUZMÁN').toUpperCase()} DE {String(ciudad || 'CIUDAD').toUpperCase()}, en uso de sus atribuciones canónicas, y","                    LA OFICINA DE CANCILLERÍA DE LA ARQUIDIÓCESIS, en ejercicio de la autoridad competente para la corrección registral sacramental, y");
rep(q,"                        <strong style={{textTransform: 'uppercase'}}>{parrocoNombre || 'PÁRROCO ENCARGADO'}</strong><br />\n                        PÁRROCO","                        <strong style={{textTransform: 'uppercase'}}>{cancillerNombre || '[CANCILLER NO CONFIGURADO]'}</strong><br />\n                        CANCILLER");
console.log('CONFIRMACION_PRINT_PATCH_OK');