-- V88 · Decreto documental sin efectos registrales (emisión y recuperación histórica).
-- Adición sin modificaciones retrospectivas a registros sacramentales.
-- Ningún usuario parroquial, diocesano ni Administrador General puede emitir por esta RPC.
create or replace function public.issue_documentary_decree_v88(
  p_parish_id uuid,
  p_sacrament_type text,
  p_decree_number text,
  p_decree_date date,
  p_target_name text,
  p_reason text,
  p_historical boolean default false,
  p_source_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_diocese uuid;
  v_parish record;
  v_chancery uuid;
  v_id uuid;
  v_number text := nullif(btrim(p_decree_number), '');
  v_reason text := nullif(btrim(p_reason), '');
  v_source text := nullif(btrim(p_source_reference), '');
  v_target text := nullif(btrim(p_target_name), '');
  v_sacrament text := lower(btrim(coalesce(p_sacrament_type,'')));
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  v_role := public.current_app_role();
  v_diocese := public.current_effective_diocese_id();
  if v_role is distinct from 'chancery' or v_diocese is null then
    raise exception 'Sólo Cancillería puede registrar decretos documentales';
  end if;
  if p_parish_id is null or v_number is null or p_decree_date is null
     or v_target is null or v_reason is null then
    raise exception 'Parroquia, número, fecha, destinatario y fundamento son obligatorios';
  end if;
  if v_sacrament not in ('bautismo','confirmacion','matrimonio','exequias') then
    raise exception 'Sacramento inválido';
  end if;
  if length(v_number)>80 or length(v_target)>300 or length(v_reason)>8000 then
    raise exception 'Uno de los campos excede la longitud permitida';
  end if;
  if p_decree_date>current_date then
    raise exception 'La fecha de un decreto emitido no puede estar en el futuro';
  end if;
  if coalesce(p_historical,false) and (v_source is null or length(v_source)<4) then
    raise exception 'El antecedente histórico exige una fuente verificable';
  end if;
  if length(coalesce(v_source,''))>1000 then
    raise exception 'Referencia documental demasiado extensa';
  end if;

  select p.id,p.name,p.diocese_id,p.is_operational into v_parish
  from public.parishes p
  where p.id=p_parish_id and p.diocese_id=v_diocese;
  if not found then raise exception 'La parroquia no pertenece a esta diócesis'; end if;
  if not coalesce(p_historical,false) and not coalesce(v_parish.is_operational,true) then
    raise exception 'No se expiden decretos nuevos para contenedores históricos';
  end if;
  select c.id into v_chancery
  from public.chancelleries c
  where c.diocese_id=v_diocese
  order by c.id
  limit 1;
  if v_chancery is null then raise exception 'No existe Cancillería para esta diócesis'; end if;

  -- Bloqueo por jurisdicción + número, incluso si falta el índice único histórico.
  perform pg_advisory_xact_lock(hashtextextended(v_diocese::text || ':' || lower(v_number), 0));
  if exists(
    select 1 from public.decretos d
    where d.diocese_id=v_diocese and lower(btrim(d.decree_number))=lower(v_number)
  ) then
    raise exception 'El número ya corresponde a otro decreto de esta diócesis';
  end if;

  insert into public.decretos (
    parish_id,diocese_id,chancery_id,tipo,sacrament_type,decree_number,decree_date,
    status,issued_by,payload
  ) values (
    p_parish_id,v_diocese,v_chancery,'documental',v_sacrament,v_number,p_decree_date,
    case when coalesce(p_historical,false) then 'archived' else 'active' end,
    case when coalesce(p_historical,false) then null else auth.uid() end,
    jsonb_build_object(
      'decreeType','documental',
      'sacramentType',v_sacrament,
      'targetName',v_target,
      'reason',v_reason,
      'parishName',v_parish.name,
      'registersEffect',false,
      'generatesMarginalNote',false,
      'affectsSacramentalRecord',false,
      'documentaryOnly',true,
      'historical',coalesce(p_historical,false),
      'recordOrigin',case when coalesce(p_historical,false) then 'historical_archive' else 'chancery_issue' end,
      'issuanceMode',case when coalesce(p_historical,false) then 'historical_documentary_recovery' else 'chancery_documentary_issue' end,
      'sourceReference',v_source,
      'documentNotice',case when coalesce(p_historical,false) then 'Reconstrucción documental del antecedente histórico; no constituye nueva emisión del acto original' else 'Decreto documental sin afectación de partidas' end
    )
  ) returning id into v_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),p_parish_id,v_diocese,'decree',v_id,
    case when coalesce(p_historical,false) then 'historical_documentary_recovery' else 'issue_documentary_decree' end,
    jsonb_build_object('decree_number',v_number,'sacrament_type',v_sacrament,'affects_record',false),
    jsonb_build_object('source_reference',v_source,'historical',coalesce(p_historical,false),'version','V88')
  );
  return v_id;
end;
$$;
revoke all on function public.issue_documentary_decree_v88(uuid,text,text,date,text,text,boolean,text) from public,anon;
grant execute on function public.issue_documentary_decree_v88(uuid,text,text,date,text,text,boolean,text) to authenticated;
comment on function public.issue_documentary_decree_v88(uuid,text,text,date,text,text,boolean,text) is
'V88: Cancillería crea decreto documental nuevo o archiva antecedente histórico, ambos visibles según RLS para Cancillería y parroquia. Nunca modifica partidas ni notas marginales.';
