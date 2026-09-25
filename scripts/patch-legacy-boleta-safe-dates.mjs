import fs from 'node:fs';
const p=`${process.cwd()}/src/config/legacyImportProfiles.js`;
let s=fs.readFileSync(p,'utf8');
const anchor=`const sourceKey = (...parts) => parts.map(v => text(v)).join('|');`;
const helper=`const safeLegacyDate = (value) => {\n  const v = dateOnly(value);\n  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(v)) return '';\n  const d = new Date(\`${'${v}'}T12:00:00\`);\n  return Number.isNaN(d.getTime()) ? '' : v;\n};\n`;
if(!s.includes('const safeLegacyDate =')) s=s.replace(anchor,helper+anchor);
s=s.replaceAll(`inscription_date:dateOnly(r.fecins)`,`inscription_date:safeLegacyDate(r.fecins)`);
s=s.replaceAll(`celebration_date:dateOnly(r.fecbau)`,`celebration_date:safeLegacyDate(r.fecbau)`);
s=s.replaceAll(`celebration_date:dateOnly(r.feccon)`,`celebration_date:safeLegacyDate(r.feccon)`);
const patchBlock=(start,end)=>{
  const a=s.indexOf(start), b=s.indexOf(end,a+start.length);
  if(a<0||b<0) throw new Error(`Bloque no encontrado: ${start}`);
  const block=s.slice(a,b).replaceAll('dateOnly(','safeLegacyDate(');
  s=s.slice(0,a)+block+s.slice(b);
};
patchBlock('  INSBAUTI: {','  INSCONFI: {');
patchBlock('  INSCONFI: {','  INSCOMUN: {');
fs.writeFileSync(p,s);
console.log('PATCH_BOLETA_SAFE_DATES_OK');
