-- SACRAMENTUM V20 · separación segura de nombres/apellidos en Párrocos legacy
begin;

create or replace function public.sacramentum_split_legacy_priest_name(p_full_name text)
returns jsonb
language plpgsql
immutable
set search_path=public
as $$
declare
  v_full text:=regexp_replace(trim(coalesce(p_full_name,'')), '\s+', ' ', 'g');
  v_first text;
  v_honorific text:='';
  v_body text;
  v_parts text[];
  v_n integer;
  v_i integer;
  v_ambiguous boolean:=false;
  v_given text;
  v_surnames text;
begin
  if v_full='' then
    return jsonb_build_object(
      'full_name','',
      'honorific','',
      'given_names','',
      'surnames','',
      'confidence','empty'
    );
  end if;

  v_first:=split_part(v_full,' ',1);
  if upper(v_first) in ('PBRO.','PBRO','PRESB.','PRESB','PRESBÍTERO','PADRE','P.') then
    v_honorific:=case when upper(v_first) in ('PBRO','PBRO.') then 'PBRO.' else upper(v_first) end;
    v_body:=trim(substr(v_full,length(v_first)+1));
  else
    v_body:=v_full;
  end if;

  v_parts:=regexp_split_to_array(v_body,'\s+');
  v_n:=coalesce(array_length(v_parts,1),0);

  if v_n>=3 then
    for v_i in 2..greatest(v_n-1,2) loop
      if upper(v_parts[v_i]) in ('DE','DEL','LA','LAS','LOS','Y','SAN','SANTA') then
        v_ambiguous:=true;
      end if;
    end loop;
  end if;

  if v_n>=3 and not v_ambiguous then
    v_given:=array_to_string(v_parts[1:v_n-2],' ');
    v_surnames:=array_to_string(v_parts[v_n-1:v_n],' ');
    return jsonb_build_object(
      'full_name',v_full,
      'honorific',v_honorific,
      'given_names',v_given,
      'surnames',v_surnames,
      'confidence','high'
    );
  end if;

  return jsonb_build_object(
    'full_name',v_full,
    'honorific',v_honorific,
    'given_names',v_body,
    'surnames','',
    'confidence','review'
  );
end;
$$;

create or replace function public.sacramentum_normalize_legacy_priest_name()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_full text;
  v_split jsonb;
  v_display_given text;
begin
  if coalesce(new.payload->>'source','')<>'legacy_migration' then
    return new;
  end if;

  v_full:=coalesce(
    nullif(trim(new.payload->>'legacy_full_name'),''),
    nullif(trim(concat_ws(' ',new.nombre,new.apellido)),'')
  );

  if v_full is null then
    return new;
  end if;

  v_split:=public.sacramentum_split_legacy_priest_name(v_full);

  new.payload:=coalesce(new.payload,'{}'::jsonb)||jsonb_build_object(
    'legacy_full_name',v_split->>'full_name',
    'legacy_honorific',v_split->>'honorific',
    'legacy_given_names',v_split->>'given_names',
    'legacy_surnames',v_split->>'surnames',
    'name_split_confidence',v_split->>'confidence'
  );

  if v_split->>'confidence'='high' then
    v_display_given:=trim(concat_ws(' ',nullif(v_split->>'honorific',''),nullif(v_split->>'given_names','')));
    new.nombre:=v_display_given;
    new.apellido:=v_split->>'surnames';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_legacy_priest_name on public.parrocos;
create trigger trg_normalize_legacy_priest_name
before insert or update of nombre,apellido,payload
on public.parrocos
for each row
execute function public.sacramentum_normalize_legacy_priest_name();

-- Backfill de los registros legacy existentes sin perder el nombre original.
update public.parrocos
set payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
  'legacy_full_name',trim(concat_ws(' ',nombre,apellido))
)
where payload->>'source'='legacy_migration';

-- La regla de Párroco Actual sigue dependiendo sólo de la fecha_ingreso más reciente.
do $$
declare r record;
begin
  for r in select distinct parish_id from public.parrocos where parish_id is not null loop
    perform public.sacramentum_recalculate_current_priest(r.parish_id);
  end loop;
end $$;

revoke all on function public.sacramentum_split_legacy_priest_name(text) from public,anon;
grant execute on function public.sacramentum_split_legacy_priest_name(text) to authenticated,service_role;

commit;