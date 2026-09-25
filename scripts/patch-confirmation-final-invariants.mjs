import fs from 'node:fs';
function patch(file, fn){let s=fs.readFileSync(file,'utf8'); s=fn(s); fs.writeFileSync(file,s,'utf8');}
const print='C:/SACRAMENTUM/SACRAMENTUM_FINAL/src/components/ConfirmationPrintTemplate.jsx';
patch(print,(s)=>{
  s=s.replace("import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';","import { convertDateToSpanishText } from '@/utils/dateTimeFormatters';\nimport { getLocalDateISO } from '@/utils/localDate';");
  s=s.replace("    const lugarConfirmacion = formatData(raw.lugarSacramento || raw.lugarConfirmacion || raw.place || parroquia);","    const lugarConfirmacion = formatData(raw.lugarSacramento || raw.lugarConfirmacion || raw.place) || '---';");
  const a=s.indexOf('    const getFechaExpedicion = () => {');
  const b=s.indexOf('    const telefono =',a);
  if(a<0||b<0) throw new Error('No se encontró getFechaExpedicion');
  s=s.slice(0,a)+"    const getFechaExpedicion = () => convertDateToSpanishText(getLocalDateISO()).replace(/^EL\\s+/i, '').toUpperCase();\n\n"+s.slice(b);
  const anchor="    const telefono = formatData(header.telefono || '');";
  const extra="    const statusLower = String(raw.status || raw.estado || '').toLowerCase();\n    const inactiveLabel = ['anulada','annulled'].includes(statusLower) ? 'ANULADA' : ['reversed','revertida'].includes(statusLower) ? 'REVERTIDA' : ['replaced','deleted'].includes(statusLower) ? 'NO VIGENTE' : '';\n\n";
  if(!s.includes(anchor)) throw new Error('No se encontró anchor status');
  s=s.replace(anchor,extra+anchor);
  return s;
});patch(print,(s)=>{
  const anchor="            overflow: 'hidden'\n        }}>";
  const wm="            overflow: 'hidden'\n        }}>\n            {inactiveLabel && (\n                <div style={{ position:'absolute', inset:0, zIndex:50, pointerEvents:'none', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>\n                    <div style={{ transform:'rotate(-35deg)', fontSize:'72px', fontWeight:900, color:'rgba(185,28,28,0.10)', border:'10px solid rgba(185,28,28,0.10)', padding:'24px 40px', borderRadius:'24px', textTransform:'uppercase' }}>{inactiveLabel}</div>\n                </div>\n            )}";
  if(!s.includes(anchor)) throw new Error('No se encontró apertura plantilla');
  return s.replace(anchor,wm);
});
const hist='C:/SACRAMENTUM/SACRAMENTUM_FINAL/src/pages/parish/ConfirmationCelebratedPage.jsx';
patch(hist,(s)=>{
  const changes=[
    ['<label className={labelClass}>Lugar Celebración</label><input name="lugarSacramento" required','<label className={labelClass}>Lugar Celebración (si consta)</label><input name="lugarSacramento"'],
    ['<select name="sexo" required','<select name="sexo"'],
    ['<input type="date" name="fechaNacimiento" required','<input type="date" name="fechaNacimiento"'],
    ['<input name="nombrePadre" required','<input name="nombrePadre"'],
    ['<input name="nombreMadre" required','<input name="nombreMadre"'],
    ['<input name="lugarBautismo" required','<input name="lugarBautismo"'],
    ['<input name="ministro" required','<input name="ministro"'],
    ['<label className={labelClass}>Da Fe (Párroco)</label><input name="daFe" required','<label className={labelClass}>Da Fe (si consta)</label><input name="daFe"'],
    ['<input name="padrinos" required','<input name="padrinos"']
  ];
  for(const [a,b] of changes){if(!s.includes(a)) throw new Error('Patrón histórico no encontrado: '+a); s=s.replace(a,b);}
  return s;
});
console.log('CONFIRMACION_FINAL_INVARIANTS_OK');