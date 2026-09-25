import fs from 'node:fs';
const p='supabase/applied-history/SACRAMENTUM_LEGACY_IMPORT_RELATIONAL_V2.sql';
let s=fs.readFileSync(p,'utf8');
const oldIdx=`create unique index if not exists uq_directory_dioceses_source_code
  on public.directory_dioceses(source_system,legacy_code) where legacy_code is not null;`;
const newIdx=`drop index if exists public.uq_directory_dioceses_source_code;
create unique index if not exists uq_directory_dioceses_source_code_name
  on public.directory_dioceses(source_system,legacy_code,(lower(name))) where legacy_code is not null;`;
if(!s.includes(oldIdx)) throw new Error('Índice DIOCESIS no encontrado');
s=s.replace(oldIdx,newIdx);
const oldLink=`  update public.directory_churches c set directory_diocese_id=d.id,updated_at=now()
  from public.directory_dioceses d
  where c.directory_diocese_id is null and c.diocese_legacy_code is not null
    and d.source_system=c.source_system and d.legacy_code=c.diocese_legacy_code;`;
const newLink=`  update public.directory_churches c set directory_diocese_id=d.id,updated_at=now()
  from public.directory_dioceses d
  join (
    select source_system,legacy_code from public.directory_dioceses
    where legacy_code is not null group by source_system,legacy_code having count(*)=1
  ) u on u.source_system=d.source_system and u.legacy_code=d.legacy_code
  where c.directory_diocese_id is null and c.diocese_legacy_code is not null
    and d.source_system=c.source_system and d.legacy_code=c.diocese_legacy_code;`;
if(!s.includes(oldLink)) throw new Error('Enlace diócesis no encontrado');
s=s.replace(oldLink,newLink);
const start=s.indexOf("      elsif v_profile='DIOCESIS' then");
const end=s.indexOf("\n      elsif v_profile='IGLESIAS' then",start);
if(start<0||end<0) throw new Error('Rama DIOCESIS no encontrada');
const branch=`      elsif v_profile='DIOCESIS' then
        select id into v_target from public.directory_dioceses
        where source_system='SACRAMENTA_PLUS' and legacy_code=nullif(d->>'legacy_code','')
          and lower(name)=lower(coalesce(nullif(d->>'name',''),'SIN NOMBRE')) limit 1;
        if v_target is null then
          insert into public.directory_dioceses(legacy_code,name,nit,address,phone,fax,email,city,bishop_1,bishop_2,source_system,raw_data)
          values(nullif(d->>'legacy_code',''),coalesce(nullif(d->>'name',''),'SIN NOMBRE'),nullif(d->>'nit',''),nullif(d->>'address',''),
            nullif(d->>'phone',''),nullif(d->>'fax',''),nullif(d->>'email',''),nullif(d->>'city',''),nullif(d->>'bishop_1',''),nullif(d->>'bishop_2',''),
            'SACRAMENTA_PLUS',coalesce(r.original_data,'{}'::jsonb)) returning id into v_target;
        else
          update public.directory_dioceses set nit=nullif(d->>'nit',''),address=nullif(d->>'address',''),phone=nullif(d->>'phone',''),
            fax=nullif(d->>'fax',''),email=nullif(d->>'email',''),city=nullif(d->>'city',''),bishop_1=nullif(d->>'bishop_1',''),
            bishop_2=nullif(d->>'bishop_2',''),raw_data=coalesce(r.original_data,'{}'::jsonb),updated_at=now() where id=v_target;
        end if;
`;
s=s.slice(0,start)+branch+s.slice(end);
fs.writeFileSync(p,s,'utf8');
console.log('PATCH_DIOCESE_COLLISION_OK');
