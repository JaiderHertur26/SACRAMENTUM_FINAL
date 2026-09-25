import fs from 'node:fs';
const files=[
'src/pages/parish/MatrimonioNewPage.jsx',
'src/pages/parish/MatrimonioCelebratedPage.jsx',
'src/pages/parish/FuneralRegistryPage.jsx',
'src/pages/parish/BaptismNewPage.jsx',
'src/pages/parish/BaptismCelebratedPage.jsx',
'src/pages/parish/ConfirmationNewPage.jsx',
'src/pages/parish/ConfirmationCelebratedPage.jsx'
];
for(const f of files){
 const lines=fs.readFileSync(f,'utf8').split(/\r?\n/);
 console.log('\n## '+f);
 lines.forEach((line,i)=>{
   if(/currentPriest|priestAtDate|bishopAtDate/.test(line)){
     const a=Math.max(0,i-5),b=Math.min(lines.length,i+10);
     console.log('---');
     for(let j=a;j<b;j++) console.log(String(j+1).padStart(4,' ')+': '+lines[j]);
   }
 });
}