import fs from 'node:fs';
const dir=process.argv[2];
const names=fs.readdirSync(dir).filter(n=>n.endsWith('.json')&&n!=='plan.json'&&n!=='index.json').sort();
fs.writeFileSync(dir+'/index.json',JSON.stringify(names));
console.log(names.length);
