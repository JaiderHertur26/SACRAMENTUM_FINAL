
import fs from 'node:fs';
const files = [
  'src/pages/parish/BaptismNewPage.jsx',
  'src/pages/parish/BaptismCelebratedPage.jsx',
  'src/pages/parish/ConfirmationNewPage.jsx',
  'src/pages/parish/MatrimonioNewPage.jsx',
  'src/pages/parish/MatrimonioCelebratedPage.jsx',
  'src/pages/parish/FuneralRegistryPage.jsx'
];
const needles = ['<datalist','list=','name="ministro"','name="daFe"','name="da_fe"','name="presencia"'];
for (const file of files) {
  const lines = fs.readFileSync(file,'utf8').split(/\r?\n/);
  console.log('\n## '+file);
  lines.forEach((line,i)=>{
    if (needles.some(n=>line.includes(n))) {
      const from=Math.max(0,i-3), to=Math.min(lines.length,i+5);
      console.log('--- lines '+(from+1)+'-'+to+' ---');
      for(let j=from;j<to;j++) console.log(String(j+1).padStart(4,' ')+': '+lines[j]);
    }
  });
}
