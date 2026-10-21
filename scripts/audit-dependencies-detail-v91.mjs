import fs from 'node:fs';
const file=process.argv[2]||'scripts/AUDITORIA_DEPENDENCIAS_V90.json';
const b=fs.readFileSync(file);const str=(b[0]===255&&b[1]===254?b.toString('utf16le'):b.toString('utf8')).replace(/^\uFEFF/,'');
const v=JSON.parse(str);
console.log('SUMMARY '+JSON.stringify(v.metadata?.vulnerabilities));
for(const [n,a] of Object.entries(v.vulnerabilities||{})){
 console.log(JSON.stringify({package:n,severity:a.severity,range:a.range,via:a.via?.map(x=>typeof x==='string'?x:({name:x.name,title:x.title,url:x.url,range:x.range,severity:x.severity})),effects:a.effects,fixAvailable:a.fixAvailable,nodes:a.nodes},null,2));
}
