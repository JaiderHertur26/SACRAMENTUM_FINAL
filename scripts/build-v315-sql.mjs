import { readFileSync, writeFileSync } from 'node:fs';
const root=new URL('../',import.meta.url);
const v314=readFileSync(new URL('supabase/deployment/v314_repetition_multiple_baptism_entries.sql',root),'utf8');
const path=new URL('supabase/deployment/v315_repetition_marginal_execution.sql',root);
let v315=readFileSync(path,'utf8');
const match=v314.match(/CREATE OR REPLACE FUNCTION public\.resolve_repetition_parish_v314\([\s\S]*?END \$fn\$;/);
if(!match)throw Error('No se encontró la función de cierre V314');
const anchor=" entries:=d.payload->'affectedEntries';";
if(!match[0].includes(anchor))throw Error('El cuerpo de V314 cambió');
const check=`
 IF p_resolution='documented' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(entries) WITH ORDINALITY AS e(value,ord)
  WHERE e.value->>'parishId'=parish::text
  AND e.value->>'disposition'='without_effect'
  AND NOT (coalesce(d.payload->'repetitionEntryActions','{}'::jsonb) ? ('entry-'||e.ord::text))
 ) THEN
  RAISE EXCEPTION 'Existen partidas con nota marginal ordenada que aún no tienen asiento o constancia individual'; END IF;`;
const func=match[0].replace(anchor,anchor+'\n'+check).replace(
  "FROM jsonb_array_elements(entries) e;\n IF NOT parish=ANY(ids)",
  "FROM jsonb_array_elements(entries) e WHERE e->>'parishId' IS NOT NULL;\n IF NOT parish=ANY(ids)"
);
if(func===match[0])throw Error('No se pudo añadir la validación');
const marker='-- V315 REDEFINITION:';
v315=v315.split(marker)[0].trimEnd()+'\n\n'+marker+' impedir cierre sin notas obligatorias.\n'+func+'\nCOMMIT;\n';
writeFileSync(path,v315);
console.log('V315 SQL generado: '+v315.split('\n').length+' líneas; guardia: '+v315.includes('Existen partidas con nota marginal ordenada'));
