import fs from 'node:fs';
for(const file of [
  'src/pages/parish/FuneralRegistryPage.jsx',
  'src/pages/parish/AvisoNotificacionMatrimonialPage.jsx'
]){
  const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
  console.log('\n## '+file);
  lines.forEach((line,i)=>{
    if(/<datalist\b|\blist\s*=/.test(line)){
      const a=Math.max(0,i-4),b=Math.min(lines.length,i+6);
      for(let j=a;j<b;j++) console.log(String(j+1).padStart(4,' ')+': '+lines[j]);
    }
  });
}