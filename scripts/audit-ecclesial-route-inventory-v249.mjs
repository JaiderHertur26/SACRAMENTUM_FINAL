// V249: route-by-route inventory, source-only, no personal data or network.
import fs from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';
import tr from '@babel/traverse';
const traverse=typeof tr==='function'?tr:tr.default;
const app=fs.readFileSync('src/App.jsx','utf8');
const tree=parse(app,{sourceType:'module',plugins:['jsx']});
const roleTypes=new Set(['DIOCESE','CHANCERY','PARISH','ADMIN_GENERAL']);
const attr=(opening,name)=>opening.attributes.find(x=>x.type==='JSXAttribute'&&x.name.name===name);
const isRoute=x=>x?.type==='JSXOpeningElement'&&x.name.type==='JSXIdentifier'&&x.name.name==='Route';
const parseRole=v=>{
 if(!v)return [];
 if(v.type==='StringLiteral')return [v.value];
 if(v.type==='JSXExpressionContainer'){
  const e=v.expression;
  if(e.type==='MemberExpression'&&e.object.name==='ROLE_TYPES'&&roleTypes.has(e.property.name))return [e.property.name.toLowerCase()];
  if(e.type==='ArrayExpression')return e.elements.flatMap(x=>parseRole({type:'JSXExpressionContainer',expression:x}));
 }
 return [];
};
const r={diocese:[],chancery:[],parish:[],admin_general:[],shared:[]},discovered=[];
traverse(tree,{
 JSXOpeningElement(p){
  const opening=p.node;if(!isRoute(opening))return;
  const pth=attr(opening,'path')?.value?.value;
  const element=attr(opening,'element')?.value?.expression;
  if(typeof pth!=='string'||!element||element.type!=='JSXElement')return;
  const protect=element.openingElement;
  if(protect.name?.name!=='ProtectedRoute')return;
  const roles=parseRole(attr(protect,'requiredRole')?.value);
  const classified=roles.filter(x=>x in r);
  if(!classified.length)return;
  const declared={path:pth,roles:classified};
  discovered.push(declared);
  if(classified.length>1)r.shared.push(pth);
  for(const x of classified)r[x].push(pth);
 }
});
for(const role of ['diocese','chancery','parish']){
 if(r[role].length<3)throw Error('Missing '+role+' routes');
}
if(r.admin_general.length<3)throw Error('Missing admin role for negative control');
const output={protocol:'V249',method:'AST of real protected React routes; visual style applies only to authenticated three-role shared DashboardLayout, not a proof of a login or individual page content inspection',role_paths:r,counts:Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v.length])),total_unique_protected_paths:new Set(discovered.map(x=>x.path)).size,admin_design_excluded:true};
fs.writeFileSync('AUDITORIA_RUTAS_ECLESIALES_V249.json',JSON.stringify(output,null,2)+'\n');
console.log('V249 ROUTE INVENTORY '+JSON.stringify(output.counts)+' unique='+output.total_unique_protected_paths);
