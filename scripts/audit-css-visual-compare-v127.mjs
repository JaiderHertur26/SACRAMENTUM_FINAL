import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
const root=process.cwd();
const previous=path.join(root,process.env.VISUAL_PREVIOUS||'AUDITORIA_EVIDENCIA_VISUAL_V119_BASELINE');
const current=path.join(root,'AUDITORIA_EVIDENCIA_VISUAL_V119');
const delta=path.join(root,process.env.VISUAL_DIFF||'AUDITORIA_EVIDENCIA_VISUAL_V127_DIFF');
fs.mkdirSync(delta,{recursive:true});
const results=[];
for(const filename of fs.readdirSync(previous).filter(x=>x.endsWith('.png')).sort()){
 const old=PNG.sync.read(fs.readFileSync(path.join(previous,filename)));
 const fresh=PNG.sync.read(fs.readFileSync(path.join(current,filename)));
 if(old.width!==fresh.width||old.height!==fresh.height)throw Error('Viewport changed '+filename);
 const diff=new PNG({width:old.width,height:old.height});
 const mismatched=pixelmatch(old.data,fresh.data,diff.data,old.width,old.height,{threshold:0.12,includeAA:false});
 fs.writeFileSync(path.join(delta,filename),PNG.sync.write(diff));
 let total=0,high=0;
 for(let i=0;i<old.data.length;i+=4){
  const dx=Math.abs(old.data[i]-fresh.data[i])+Math.abs(old.data[i+1]-fresh.data[i+1])+Math.abs(old.data[i+2]-fresh.data[i+2]);
  total+=dx;
  if(dx>120)high++;
 }
 const pixels=old.width*old.height;
 const outcome={filename,dimensions:[old.width,old.height],mismatched,mismatchPct:+(mismatched/pixels*100).toFixed(2),
   meanRgbChannelDiff:+(total/(pixels*3)).toFixed(2),highDeltaPct:+(high/pixels*100).toFixed(2)};
 results.push(outcome);
 console.log(filename+' changed='+outcome.mismatchPct+'% meanChannelDiff='+outcome.meanRgbChannelDiff+' highDelta='+outcome.highDeltaPct+'%');
}
fs.writeFileSync(process.env.VISUAL_REPORT||'AUDITORIA_COMPARACION_VISUAL_TAILWIND_V127.json',JSON.stringify({date:new Date().toISOString(),
 baseline:process.env.VISUAL_PREVIOUS==='AUDITORIA_EVIDENCIA_VISUAL_V127_FIRST'?'Tailwind v4, primera ejecución de Chrome':'Tailwind v3, V119 screenshots',
 candidate:process.env.VISUAL_PREVIOUS==='AUDITORIA_EVIDENCIA_VISUAL_V127_FIRST'?'Tailwind v4, segunda ejecución de Chrome':'Tailwind v4, V127 screenshots',results},null,2)+'\n');
