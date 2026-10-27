import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

// This is a conservative offline SQL LEXER, not a PostgreSQL parser.
// Semicolons inside quoted text, PL/pgSQL dollar-quoted functions and comments
// are not statement boundaries. No SQL is executed by this script.
function topLevelStatements(source) {
  const out=[];
  let state='code',buf='',quoteTag='',blockDepth=0;
  const push=()=>{const t=buf.trim();if(t)out.push(t);buf='';};
  for(let i=0;i<source.length;){
    const c=source[i],next=source[i+1]??'';
    if(state==='line') {if(c==='\n'){buf+=' ';state='code';} i++;continue;}
    if(state==='block') {
      if(c==='/' && next==='*'){blockDepth++;i+=2;continue;}
      if(c==='*' && next==='/'){blockDepth--;i+=2;if(blockDepth===0){buf+=' ';state='code';}continue;}
      i++;continue;
    }
    if(state==='single'){
      if(c==="'"&&next==="'"){i+=2;continue;}
      if(c==="'"&&source[i-1]!=='\\'){buf+=' ? ';state='code';}
      i++;continue;
    }
    if(state==='double') {
      if(c==='"'&&next==='"'){i+=2;continue;}
      if(c==='"'){buf+=' "quoted" ';state='code';}
      i++;continue;
    }
    if(state==='dollar'){
      if(source.startsWith(quoteTag,i)){buf+=' $quoted_body$ ';i+=quoteTag.length;state='code';continue;}
      i++;continue;
    }
    if(c==='-'&&next==='-'){state='line';i+=2;continue;}
    if(c==='/'&&next==='*'){state='block';blockDepth=1;i+=2;continue;}
    if(c==="'"){state='single';i++;continue;}
    if(c==='"'){state='double';i++;continue;}
    if(c==='$'){
      const m=source.slice(i).match(/^\$[A-Za-z_][A-Za-z_0-9]*\$|^\$\$/);
      if(m){state='dollar';quoteTag=m[0];i+=quoteTag.length;continue;}
    }
    if(c===';'){push();i++;continue;}
    buf+=c;i++;
  }
  if(state!=='code'&&state!=='line')throw Error('Unterminated '+state);
  push();return out;
}
function report() {
 const files=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
 const findings=[], counts={},checks=[];
 for(const f of files){
  const full='supabase/migrations/'+f;
  const source=fs.readFileSync(full,'utf8');
  const stmts=topLevelStatements(source);
  const sha256=crypto.createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex');
  let directWrites=0;
  const actions=[];
  for(let i=0;i<stmts.length;i++){
   const s=stmts[i].replace(/\s+/g,' ').trim(),lower=s.toLowerCase();
   const match=s.match(/^(INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE|COPY|MERGE\s+INTO|REFRESH\s+MATERIALIZED\s+VIEW|WITH\b)/i);
   const exprCall=/^SELECT\s+(?:public\.)?(?:import|backfill|seed|materialize|migrate|populate|initialize)_[a-z_0-9]+\s*\(/i.test(s);
   if(match||exprCall){
    const action=match?.[1]?.toUpperCase()||'SELECT-SIDE-EFFECT-CANDIDATE';
    if(action==='WITH'&&!/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO)\b/i.test(s))continue;
    actions.push({statementIndex:i+1,kind:action,head:s.slice(0,175),sourceSha256:sha256});
    directWrites++;
   }
  }
  counts[f]=stmts.length;
  if(directWrites)findings.push({file:full,sha256,actions});
  checks.push({file:full,sha256,directWrites,statements:stmts.length});
 }
 return {migrationCount:files.length,directWriteMigrationCount:findings.length,
 directWriteStatementCount:findings.reduce((n,f)=>n+f.actions.length,0),findings,checks};
}
const snapshot=report();
if(process.argv.includes('--inventory')){
 fs.writeFileSync('AUDITORIA_MIGRACIONES_DATOS_V232.json',JSON.stringify({protocol:'V232',environment:'OFFLINE_QA_SCHEMAS_ONLY',...snapshot},null,2)+'\n');
 console.log(JSON.stringify({migrationCount:snapshot.migrationCount,directWriteMigrationCount:snapshot.directWriteMigrationCount,directWriteStatementCount:snapshot.directWriteStatementCount,writeMigrations:snapshot.findings},null,2));
}else{
 const official=JSON.parse(fs.readFileSync('AUDITORIA_MIGRACIONES_DATOS_V232.json','utf8'));
 if(official.protocol!=='V232'||official.migrationCount!==snapshot.migrationCount||
 official.directWriteMigrationCount!==snapshot.directWriteMigrationCount||
 JSON.stringify(official.checks)!==JSON.stringify(snapshot.checks)||
 JSON.stringify(official.findings)!==JSON.stringify(snapshot.findings))
 throw Error('Migration code changed since classification; freeze official launch until a fresh review');
 console.log('V231 migration scanner: '+snapshot.migrationCount+
 ' versioned files; '+snapshot.directWriteMigrationCount+' direct-data migration(s) pinned; clean release inventory unchanged');
}
export {topLevelStatements,report};