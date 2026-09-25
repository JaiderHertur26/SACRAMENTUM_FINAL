begin;

-- SACRAMENTUM V29
-- Resolución inteligente de códigos legacy:
-- 1) sexo 1/2 -> MASCULINO/FEMENINO
-- 2) tipo de unión 1..5 -> etiqueta histórica
-- 3) código de párroco/Da Fe/Ministro -> nombre del catálogo Párrocos
-- La resolución de sacerdote siempre queda limitada a la misma parroquia.

create or replace function public.sacramentum_legacy_code(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := trim(coalesce(p_value,''));
  if v = '' then return null; end if;
  v := regexp_replace(v, '\.0$', '');
  if v !~ '^\d+$' then return null; end if;
  if length(v) < 4 then v := lpad(v,4,'0'); end if;
  return v;
end;
$$;

create or replace function public.sacramentum_legacy_sex_label(p_value text)
returns text
language plpgsql
immutable
as $$
declare v text := upper(trim(coalesce(p_value,'')));
begin
  if v = '' then return null; end if;
  if v in ('1','M','MASC','MASCULINO') or v like 'MASC%' then return 'MASCULINO'; end if;
  if v in ('2','F','FEM','FEMENINO') or v like 'FEM%' then return 'FEMENINO'; end if;
  return v;
end;
$$;

create or replace function public.sacramentum_legacy_union_label(p_value text)
returns text
language plpgsql
immutable
as $$
declare v text := upper(trim(coalesce(p_value,'')));
begin
  if v = '' then return null; end if;
  return case v
    when '1' then 'MATRIMONIO CATÓLICO'
    when '2' then 'MATRIMONIO CIVIL'
    when '3' then 'UNIÓN LIBRE'
    when '4' then 'MADRE SOLTERA'
    when '5' then 'OTRO CASO'
    else v
  end;
end;
$$;

create or replace function public.sacramentum_resolve_legacy_priest_name(
  p_parish_id uuid,
  p_value text
)
returns text
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_code text;
  v_count integer;
  v_name text;
begin
  if p_parish_id is null then return null; end if;
  v_code := public.sacramentum_legacy_code(p_value);
  if v_code is null then return null; end if;

  select count(*)::integer,
         max(
           coalesce(
             nullif(trim(p.payload->>'legacy_full_name'),''),
             nullif(trim(p.payload->>'nombreCompleto'),''),
             nullif(trim(concat_ws(' ',p.nombre,p.apellido)),'')
           )
         )
    into v_count,v_name
  from public.parrocos p
  where p.parish_id=p_parish_id
    and public.sacramentum_legacy_code(
      coalesce(
        nullif(p.payload->>'legacy_code',''),
        nullif(p.payload->>'legacyCode',''),
        nullif(p.payload->>'codigo','')
      )
    )=v_code;

  if v_count=1 and nullif(trim(coalesce(v_name,'')),'') is not null then
    return upper(trim(v_name));
  end if;
  return null;
end;
$$;

create or replace function public.sacramentum_legacy_priest_display(
  p_parish_id uuid,
  p_value text
)
returns text
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_input text := trim(coalesce(p_value,''));
  v_code text;
  v_name text;
begin
  if v_input='' then return null; end if;
  v_code := public.sacramentum_legacy_code(v_input);
  if v_code is null then return upper(v_input); end if;

  v_name := public.sacramentum_resolve_legacy_priest_name(p_parish_id,v_code);
  if v_name is not null then return v_name; end if;

  return 'CÓDIGO LEGADO '||v_code||' · NOMBRE NO CONSTA';
end;
$$;

create or replace function public.sacramentum_enrich_legacy_raw_data(
  p_parish_id uuid,
  p_raw jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  b jsonb := coalesce(p_raw,'{}'::jsonb) - 'legacy_resolved';
  n jsonb := coalesce((coalesce(p_raw,'{}'::jsonb) - 'legacy_resolved')->'legacy_normalized','{}'::jsonb);
  v_dafe text;
  v_minister text;
  v_sex text;
  v_union text;
  v_party1_sex text;
  v_party2_sex text;
  v_resolved jsonb;
begin
  v_dafe := coalesce(
    nullif(b->>'dafe',''),
    nullif(b->>'daFe',''),
    nullif(b->>'da_fe',''),
    nullif(b->>'legacy_dafe_code',''),
    nullif(n->>'legacy_dafe_code','')
  );

  v_minister := coalesce(
    nullif(b->>'ministro',''),
    nullif(b->>'minister',''),
    nullif(b->>'presenciaria',''),
    nullif(n->>'minister','')
  );

  v_sex := coalesce(
    nullif(b->>'sexo',''),
    nullif(b->>'sex',''),
    nullif(b->>'gender',''),
    nullif(n->>'gender','')
  );

  v_union := coalesce(
    nullif(b->>'tipohijo',''),
    nullif(b->>'tipoUnionPadres',''),
    nullif(b->>'tipo_union_padres',''),
    nullif(b->>'parent_union_type',''),
    nullif(n->>'parent_union_type','')
  );

  v_party1_sex := coalesce(
    nullif(n->'party_1'->>'gender',''),
    nullif(b->>'sexo1',''),
    nullif(b->>'sexo_1',''),
    nullif(b->>'sex1','')
  );
  v_party2_sex := coalesce(
    nullif(n->'party_2'->>'gender',''),
    nullif(b->>'sexo2',''),
    nullif(b->>'sexo_2',''),
    nullif(b->>'sex2','')
  );

  v_resolved := jsonb_strip_nulls(jsonb_build_object(
    'sexo', public.sacramentum_legacy_sex_label(v_sex),
    'tipo_union_padres', public.sacramentum_legacy_union_label(v_union),
    'daFe', public.sacramentum_legacy_priest_display(p_parish_id,v_dafe),
    'legacy_dafe_code', public.sacramentum_legacy_code(v_dafe),
    'ministro', public.sacramentum_legacy_priest_display(p_parish_id,v_minister),
    'legacy_minister_code', public.sacramentum_legacy_code(v_minister),
    'party_1_gender', public.sacramentum_legacy_sex_label(v_party1_sex),
    'party_2_gender', public.sacramentum_legacy_sex_label(v_party2_sex)
  ));

  if v_resolved='{}'::jsonb then return b; end if;
  return b || jsonb_build_object('legacy_resolved',v_resolved);
end;
$$;

create or replace function public.sacramentum_normalize_legacy_record_before_write()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_dafe text;
  v_minister text;
  v_sex text;
  v_union text;
begin
  new.raw_data := public.sacramentum_enrich_legacy_raw_data(new.parish_id,new.raw_data);

  if tg_table_name='baptisms' then
    v_sex := coalesce(nullif(new.sexo,''),nullif(new.raw_data->'legacy_resolved'->>'sexo',''));
    v_union := coalesce(nullif(new.tipo_union_padres,''),nullif(new.raw_data->'legacy_resolved'->>'tipo_union_padres',''));
    v_dafe := coalesce(
      nullif(new.raw_data->'legacy_resolved'->>'legacy_dafe_code',''),
      nullif(new.raw_data->>'legacy_dafe_code',''),
      nullif(new.raw_data->'legacy_normalized'->>'legacy_dafe_code',''),
      case when public.sacramentum_legacy_code(new.da_fe) is not null then new.da_fe else null end,
      nullif(new.da_fe,''),
      nullif(new.raw_data->'legacy_resolved'->>'daFe','')
    );
    v_minister := coalesce(
      nullif(new.raw_data->'legacy_resolved'->>'legacy_minister_code',''),
      case when public.sacramentum_legacy_code(new.ministro) is not null then new.ministro else null end,
      nullif(new.ministro,''),
      nullif(new.raw_data->'legacy_resolved'->>'ministro','')
    );

    new.sexo := public.sacramentum_legacy_sex_label(v_sex);
    new.tipo_union_padres := public.sacramentum_legacy_union_label(v_union);
    new.da_fe := public.sacramentum_legacy_priest_display(new.parish_id,v_dafe);
    new.ministro := public.sacramentum_legacy_priest_display(new.parish_id,v_minister);

  elsif tg_table_name='confirmations' then
    v_sex := coalesce(nullif(new.sexo,''),nullif(new.raw_data->'legacy_resolved'->>'sexo',''));
    v_union := coalesce(nullif(new.tipo_union_padres,''),nullif(new.raw_data->'legacy_resolved'->>'tipo_union_padres',''));
    v_dafe := coalesce(
      nullif(new.raw_data->'legacy_resolved'->>'legacy_dafe_code',''),
      nullif(new.raw_data->>'legacy_dafe_code',''),
      nullif(new.raw_data->'legacy_normalized'->>'legacy_dafe_code',''),
      case when public.sacramentum_legacy_code(new.da_fe) is not null then new.da_fe else null end,
      nullif(new.da_fe,''),
      nullif(new.raw_data->'legacy_resolved'->>'daFe','')
    );
    v_minister := coalesce(
      nullif(new.raw_data->'legacy_resolved'->>'legacy_minister_code',''),
      case when public.sacramentum_legacy_code(new.ministro) is not null then new.ministro else null end,
      nullif(new.ministro,''),
      nullif(new.raw_data->'legacy_resolved'->>'ministro','')
    );

    new.sexo := public.sacramentum_legacy_sex_label(v_sex);
    new.tipo_union_padres := public.sacramentum_legacy_union_label(v_union);
    new.da_fe := public.sacramentum_legacy_priest_display(new.parish_id,v_dafe);
    new.ministro := public.sacramentum_legacy_priest_display(new.parish_id,v_minister);

  elsif tg_table_name='funerals' then
    v_sex := coalesce(nullif(new.sexo,''),nullif(new.raw_data->'legacy_resolved'->>'sexo',''));
    v_dafe := coalesce(
      nullif(new.raw_data->'legacy_resolved'->>'legacy_dafe_code',''),
      nullif(new.raw_data->>'legacy_dafe_code',''),
      nullif(new.raw_data->'legacy_normalized'->>'legacy_dafe_code',''),
      case when public.sacramentum_legacy_code(new.da_fe) is not null then new.da_fe else null end,
      nullif(new.da_fe,''),
      nullif(new.raw_data->'legacy_resolved'->>'daFe','')
    );
    v_minister := coalesce(
      nullif(new.raw_data->'legacy_resolved'->>'legacy_minister_code',''),
      case when public.sacramentum_legacy_code(new.ministro) is not null then new.ministro else null end,
      nullif(new.ministro,''),
      nullif(new.raw_data->'legacy_resolved'->>'ministro','')
    );

    new.sexo := public.sacramentum_legacy_sex_label(v_sex);
    new.da_fe := public.sacramentum_legacy_priest_display(new.parish_id,v_dafe);
    new.ministro := public.sacramentum_legacy_priest_display(new.parish_id,v_minister);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_baptisms_legacy_normalization_v29 on public.baptisms;
create trigger trg_baptisms_legacy_normalization_v29
before insert or update on public.baptisms
for each row execute function public.sacramentum_normalize_legacy_record_before_write();

drop trigger if exists trg_confirmations_legacy_normalization_v29 on public.confirmations;
create trigger trg_confirmations_legacy_normalization_v29
before insert or update on public.confirmations
for each row execute function public.sacramentum_normalize_legacy_record_before_write();

drop trigger if exists trg_marriages_legacy_normalization_v29 on public.marriages;
create trigger trg_marriages_legacy_normalization_v29
before insert or update on public.marriages
for each row execute function public.sacramentum_normalize_legacy_record_before_write();

drop trigger if exists trg_funerals_legacy_normalization_v29 on public.funerals;
create trigger trg_funerals_legacy_normalization_v29
before insert or update on public.funerals
for each row execute function public.sacramentum_normalize_legacy_record_before_write();

drop trigger if exists trg_pending_baptisms_legacy_normalization_v29 on public.pending_baptisms;
create trigger trg_pending_baptisms_legacy_normalization_v29
before insert or update on public.pending_baptisms
for each row execute function public.sacramentum_normalize_legacy_record_before_write();

drop trigger if exists trg_pending_confirmations_legacy_normalization_v29 on public.pending_confirmations;
create trigger trg_pending_confirmations_legacy_normalization_v29
before insert or update on public.pending_confirmations
for each row execute function public.sacramentum_normalize_legacy_record_before_write();

drop trigger if exists trg_pending_marriages_legacy_normalization_v29 on public.pending_marriages;
create trigger trg_pending_marriages_legacy_normalization_v29
before insert or update on public.pending_marriages
for each row execute function public.sacramentum_normalize_legacy_record_before_write();

drop trigger if exists trg_pending_funerals_legacy_normalization_v29 on public.pending_funerals;
create trigger trg_pending_funerals_legacy_normalization_v29
before insert or update on public.pending_funerals
for each row execute function public.sacramentum_normalize_legacy_record_before_write();

create or replace function public.sacramentum_refresh_legacy_reference_labels(p_parish_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  n_b integer:=0;
  n_c integer:=0;
  n_m integer:=0;
  n_f integer:=0;
  n_pb integer:=0;
  n_pc integer:=0;
  n_pm integer:=0;
  n_pf integer:=0;
begin
  update public.baptisms b
     set raw_data=coalesce(b.raw_data,'{}'::jsonb),
         updated_at=now()
   where (p_parish_id is null or b.parish_id=p_parish_id)
     and (
       coalesce(b.raw_data->>'source','')='legacy_import'
       or b.raw_data ? 'legacy_normalized'
       or coalesce(b.da_fe,'') ~ '^\s*\d+(?:\.0)?\s*$'
       or coalesce(b.sexo,'') in ('1','2')
       or coalesce(b.tipo_union_padres,'') in ('1','2','3','4','5')
     );
  get diagnostics n_b=row_count;

  update public.confirmations c
     set raw_data=coalesce(c.raw_data,'{}'::jsonb),
         updated_at=now()
   where (p_parish_id is null or c.parish_id=p_parish_id)
     and (
       coalesce(c.raw_data->>'source','')='legacy_import'
       or c.raw_data ? 'legacy_normalized'
       or coalesce(c.da_fe,'') ~ '^\s*\d+(?:\.0)?\s*$'
       or coalesce(c.sexo,'') in ('1','2')
       or coalesce(c.tipo_union_padres,'') in ('1','2','3','4','5')
     );
  get diagnostics n_c=row_count;

  update public.marriages m
     set raw_data=coalesce(m.raw_data,'{}'::jsonb),
         updated_at=now()
   where (p_parish_id is null or m.parish_id=p_parish_id)
     and (
       coalesce(m.raw_data->>'source','')='legacy_import'
       or m.raw_data ? 'legacy_normalized'
       or coalesce(m.raw_data->>'dafe','') ~ '^\s*\d+(?:\.0)?\s*$'
       or coalesce(m.raw_data->>'sexo','') in ('1','2')
     );
  get diagnostics n_m=row_count;

  update public.funerals f
     set raw_data=coalesce(f.raw_data,'{}'::jsonb),
         updated_at=now()
   where (p_parish_id is null or f.parish_id=p_parish_id)
     and (
       coalesce(f.raw_data->>'source','')='legacy_import'
       or f.raw_data ? 'legacy_normalized'
       or coalesce(f.da_fe,'') ~ '^\s*\d+(?:\.0)?\s*$'
       or coalesce(f.sexo,'') in ('1','2')
     );
  get diagnostics n_f=row_count;

  update public.pending_baptisms x
     set raw_data=coalesce(x.raw_data,'{}'::jsonb)
   where (p_parish_id is null or x.parish_id=p_parish_id)
     and (
       x.raw_data ? 'legacy_normalized'
       or coalesce(x.raw_data->>'dafe','') ~ '^\s*\d+(?:\.0)?\s*$'
       or coalesce(x.raw_data->>'sexo','') in ('1','2')
       or coalesce(x.raw_data->>'tipohijo','') in ('1','2','3','4','5')
     );
  get diagnostics n_pb=row_count;

  update public.pending_confirmations x
     set raw_data=coalesce(x.raw_data,'{}'::jsonb)
   where (p_parish_id is null or x.parish_id=p_parish_id)
     and (
       x.raw_data ? 'legacy_normalized'
       or coalesce(x.raw_data->>'dafe','') ~ '^\s*\d+(?:\.0)?\s*$'
       or coalesce(x.raw_data->>'sexo','') in ('1','2')
     );
  get diagnostics n_pc=row_count;

  update public.pending_marriages x
     set raw_data=coalesce(x.raw_data,'{}'::jsonb)
   where (p_parish_id is null or x.parish_id=p_parish_id)
     and (
       x.raw_data ? 'legacy_normalized'
       or coalesce(x.raw_data->>'dafe','') ~ '^\s*\d+(?:\.0)?\s*$'
       or coalesce(x.raw_data->>'sexo','') in ('1','2')
     );
  get diagnostics n_pm=row_count;

  update public.pending_funerals x
     set raw_data=coalesce(x.raw_data,'{}'::jsonb),
         updated_at=now()
   where (p_parish_id is null or x.parish_id=p_parish_id)
     and (
       x.raw_data ? 'legacy_normalized'
       or coalesce(x.raw_data->>'dafe','') ~ '^\s*\d+(?:\.0)?\s*$'
       or coalesce(x.raw_data->>'sexo','') in ('1','2')
     );
  get diagnostics n_pf=row_count;

  return jsonb_build_object(
    'baptisms',n_b,
    'confirmations',n_c,
    'marriages',n_m,
    'funerals',n_f,
    'pending_baptisms',n_pb,
    'pending_confirmations',n_pc,
    'pending_marriages',n_pm,
    'pending_funerals',n_pf
  );
end;
$$;

create or replace function public.sacramentum_refresh_legacy_reference_labels_on_priest_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_parish uuid;
begin
  if tg_op='DELETE' then
    v_parish:=old.parish_id;
  else
    v_parish:=new.parish_id;
  end if;

  if v_parish is not null then
    perform public.sacramentum_refresh_legacy_reference_labels(v_parish);
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_parrocos_refresh_legacy_references_v29 on public.parrocos;
create trigger trg_parrocos_refresh_legacy_references_v29
after insert or update or delete on public.parrocos
for each row execute function public.sacramentum_refresh_legacy_reference_labels_on_priest_change();

-- Backfill inicial: normaliza lo ya importado sin borrar el JSON original.
select public.sacramentum_refresh_legacy_reference_labels(null);

revoke all on function public.sacramentum_resolve_legacy_priest_name(uuid,text) from public;
revoke all on function public.sacramentum_legacy_priest_display(uuid,text) from public;
revoke all on function public.sacramentum_enrich_legacy_raw_data(uuid,jsonb) from public;
revoke all on function public.sacramentum_refresh_legacy_reference_labels(uuid) from public;
revoke all on function public.sacramentum_refresh_legacy_reference_labels_on_priest_change() from public;
revoke all on function public.sacramentum_normalize_legacy_record_before_write() from public;

commit;
