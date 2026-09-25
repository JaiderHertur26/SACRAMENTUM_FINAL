import http from 'node:http';
import fs from 'node:fs';
const out='C:\\SACRAMENTUM\\SACRAMENTUM_FINAL\\scripts\\audit-live-result.json';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const server=http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){ res.writeHead(204,cors); res.end(); return; }
  if(req.method==='POST' && req.url==='/audit'){
    let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
      fs.writeFileSync(out,body,'utf8');
      res.writeHead(200,{...cors,'Content-Type':'text/plain'}); res.end('OK');
      console.log('AUDIT_RECEIVED'); setTimeout(()=>server.close(),250);
    }); return;
  }
  res.writeHead(200,{...cors,'Content-Type':'text/plain'}); res.end('READY');
});
server.listen(5191,'127.0.0.1',()=>console.log('AUDIT_RECEIVER_READY_5191'));
