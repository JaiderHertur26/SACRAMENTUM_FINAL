-- SACRAMENTUM · PRE-FLIGHT FASE 4 TERRITORIAL · 2026-09-05
-- Sólo diagnóstico. No modifica datos.

-- 1. Columnas canónicas requeridas por el flujo territorial.
with required(table_name,column_name) as (
  values
    ('vicarias','id'),('vicarias','diocese_id'),('vicarias','name'),('vicarias','vicar_name'),
    ('decanatos','id'),('decanatos','diocese_id'),('decanatos','vicaria_id'),('decanatos','name'),('decanatos','dean_name'),
    ('parishes','id'),('parishes','diocese_id'),('parishes','name'),('parishes','city'),('parishes','parroco'),('parishes','vicary_id'),('parishes','decanate_id'),
    ('chancelleries','id'),('chancelleries','diocese_id'),('chancelleries','name'),('chancelleries','city'),
    ('pending_tokens','type'),('pending_tokens','payload'),('pending_tokens','created_by'),
    ('user_profiles','auth_user_id'),('user_profiles','role'),('user_profiles','diocese_id'),('user_profiles','parish_id'),('user_profiles','chancery_id'),('user_profiles','status'),('user_profiles','is_active')
)
select r.table_name,r.column_name,
       case when c.column_name is null then 'MISSING' else 'OK' end as status
from required r
left join information_schema.columns c
  on c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name
order by r.table_name,r.column_name;

-- 2. Una sola Cancillería por jurisdicción.
select diocese_id,count(*) as chancelleries
from public.chancelleries
where diocese_id is not null
group by diocese_id
having count(*)>1;

-- 3. Decanatos fuera de jerarquía.
select d.id,d.name,d.diocese_id,d.vicaria_id,v.diocese_id as vicaria_diocese_id
from public.decanatos d
left join public.vicarias v on v.id=d.vicaria_id
where d.vicaria_id is null
   or v.id is null
   or v.diocese_id is distinct from d.diocese_id;

-- 4. Parroquias que todavía requieren clasificación canónica o tienen cruce territorial.
select p.id,p.name,p.diocese_id,p.vicary_id,p.decanate_id,
       v.diocese_id as vicaria_diocese_id,
       d.diocese_id as decanato_diocese_id,
       d.vicaria_id as decanato_vicaria_id
from public.parishes p
left join public.vicarias v on v.id=p.vicary_id
left join public.decanatos d on d.id=p.decanate_id
where p.vicary_id is null
   or p.decanate_id is null
   or v.id is null
   or d.id is null
   or v.diocese_id is distinct from p.diocese_id
   or d.diocese_id is distinct from p.diocese_id
   or d.vicaria_id is distinct from p.vicary_id;

-- 5. Códigos pendientes que no cumplen el gobierno esperado.
select pt.id,pt.type,pt.created_by,pt.payload,up.role as creator_role,up.diocese_id as creator_diocese
from public.pending_tokens pt
left join public.user_profiles up on up.auth_user_id=pt.created_by
where
  (upper(pt.type)='DIOCESE' and lower(coalesce(up.role,''))<>'admin_general')
  or
  (upper(pt.type) in ('PARISH','CHANCERY') and (
      lower(coalesce(up.role,''))<>'diocese'
      or coalesce(pt.payload->>'dioceseId','')<>coalesce(up.diocese_id::text,'')
      or (upper(pt.type)='PARISH' and (coalesce(pt.payload->>'vicaryId','')='' or coalesce(pt.payload->>'decanateId','')=''))
  ));

-- 6. Resumen actual.
select
  (select count(*) from public.dioceses) as jurisdictions,
  (select count(*) from public.vicarias) as vicarias,
  (select count(*) from public.decanatos) as decanatos,
  (select count(*) from public.parishes) as parishes,
  (select count(*) from public.chancelleries) as chancelleries,
  (select count(*) from public.pending_tokens) as pending_tokens;
