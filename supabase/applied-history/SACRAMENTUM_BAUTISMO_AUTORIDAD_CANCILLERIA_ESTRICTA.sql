-- SACRAMENTUM · BAUTISMO · AUTORIDAD ESTRICTA DE CANCILLERÍA
-- Capa final sobre RPC históricas: una sola autoridad institucional.
-- No modifica partidas por sí sola; sólo endurece entrada, evidencia y permisos.

begin;

create or replace function public.sacramentum_assert_chancery_for_parish(p_parish_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_user_diocese uuid;
  v_chancery uuid;
  v_target_diocese uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(role,'')),diocese_id,chancery_id
    into v_role,v_user_diocese,v_chancery
  from public.user_profiles
  where auth_user_id=auth.uid()
    and coalesce(is_active,true)=true
    and coalesce(status,'active') not in ('blocked','disabled','inactive')
  limit 1;
  if v_role is distinct from 'chancery' or v_chancery is null then
    raise exception 'Sólo Cancillería puede emitir o revertir decretos sacramentales';
  end if;  select diocese_id into v_target_diocese
  from public.parishes where id=p_parish_id;
  if v_target_diocese is null then raise exception 'Parroquia no encontrada o sin diócesis'; end if;
  if v_user_diocese is distinct from v_target_diocese then
    raise exception 'La parroquia está fuera de la jurisdicción de Cancillería';
  end if;
end;
$$;

revoke all on function public.sacramentum_assert_chancery_for_parish(uuid) from public,anon,authenticated;
grant execute on function public.sacramentum_assert_chancery_for_parish(uuid) to service_role;

do $$
begin
  if to_regprocedure('public.apply_baptism_correction_internal(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)') is null then
    if to_regprocedure('public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)') is null then
      raise exception 'Falta apply_baptism_correction canónica';
    end if;
    execute 'alter function public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) rename to apply_baptism_correction_internal';
  end if;
  if to_regprocedure('public.apply_baptism_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)') is null then
    if to_regprocedure('public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)') is null then
      raise exception 'Falta apply_baptism_replacement canónica';
    end if;
    execute 'alter function public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) rename to apply_baptism_replacement_internal';
  end if;
end;
$$;create or replace function public.apply_baptism_correction(
  p_parish_id uuid,p_original_baptism_id uuid,p_decree_number text,p_decree_date date,
  p_concept_id uuid,p_corrected_data jsonb,p_decree_payload jsonb,
  p_annulled_note text,p_replacement_note text,
  p_expected_book integer,p_expected_folio integer,p_expected_number integer
)
returns table(decree_id uuid,replacement_baptism_id uuid,book_number text,folio text,number text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_status text;
  v_reason text;
  v_blocked boolean;
begin
  perform public.sacramentum_assert_chancery_for_parish(p_parish_id);
  if p_concept_id is null then raise exception 'El concepto del decreto de corrección es obligatorio'; end if;
  v_reason:=nullif(trim(coalesce(p_decree_payload->>'reason',p_decree_payload->>'fundamento','')),'');
  if v_reason is null then raise exception 'El fundamento de la corrección es obligatorio'; end if;
  select lower(coalesce(status,'')) into v_status
  from public.baptisms where id=p_original_baptism_id and parish_id=p_parish_id;
  if not found then raise exception 'La partida original no existe en la parroquia seleccionada'; end if;
  if v_status in ('anulada','annulled','reversed','revertida','replaced','deleted') then
    raise exception 'La partida original no está vigente para una nueva corrección';
  end if;  select coalesce((bautizos_params->>'suplementarioBlocked')::boolean,false)
    into v_blocked from public.parish_parameters where parish_id=p_parish_id;
  if v_blocked then raise exception 'El Libro Supletorio de Bautismo está bloqueado'; end if;
  return query select * from public.apply_baptism_correction_internal(
    p_parish_id,p_original_baptism_id,p_decree_number,p_decree_date,p_concept_id,
    p_corrected_data,p_decree_payload,p_annulled_note,p_replacement_note,
    p_expected_book,p_expected_folio,p_expected_number
  );
end;
$$;

create or replace function public.apply_baptism_replacement(
  p_parish_id uuid,p_decree_number text,p_decree_date date,p_concept_id uuid,
  p_new_data jsonb,p_decree_payload jsonb,p_replacement_note text,
  p_expected_book integer,p_expected_folio integer,p_expected_number integer
)
returns table(decree_id uuid,replacement_baptism_id uuid,book_number text,folio text,number text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_reason text;
  v_evidence jsonb;
  v_blocked boolean;
begin
  perform public.sacramentum_assert_chancery_for_parish(p_parish_id);
  if p_concept_id is null then raise exception 'El concepto del decreto de reposición es obligatorio'; end if;  v_reason:=nullif(trim(coalesce(p_new_data->>'reason',p_new_data->>'fundamento',
    p_decree_payload->>'reason',p_decree_payload->>'fundamento','')),'');
  if v_reason is null then raise exception 'El fundamento de la reposición es obligatorio'; end if;
  v_evidence:=coalesce(p_new_data->'decreeEvidence',p_decree_payload->'evidence','{}'::jsonb);
  if jsonb_typeof(v_evidence)<>'object'
     or nullif(trim(coalesce(v_evidence->>'type','')),'') is null
     or nullif(trim(coalesce(v_evidence->>'reference','')),'') is null
     or nullif(trim(coalesce(v_evidence->>'issuer','')),'') is null
     or nullif(trim(coalesce(v_evidence->>'description','')),'') is null then
    raise exception 'La reposición exige evidencia identificada: tipo, referencia, emisor/custodio y descripción';
  end if;
  select coalesce((bautizos_params->>'suplementarioBlocked')::boolean,false)
    into v_blocked from public.parish_parameters where parish_id=p_parish_id;
  if v_blocked then raise exception 'El Libro Supletorio de Bautismo está bloqueado'; end if;
  return query select * from public.apply_baptism_replacement_internal(
    p_parish_id,p_decree_number,p_decree_date,p_concept_id,p_new_data,
    p_decree_payload,p_replacement_note,p_expected_book,p_expected_folio,p_expected_number
  );
end;
$$;

revoke all on function public.apply_baptism_correction_internal(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.apply_baptism_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.apply_baptism_correction_internal(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) to service_role;
grant execute on function public.apply_baptism_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) to service_role;revoke all on function public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) from public,anon;
revoke all on function public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) from public,anon;
grant execute on function public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) to authenticated,service_role;
grant execute on function public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) to authenticated,service_role;

do $$
begin
  if to_regprocedure('public.reverse_correction_decree_with_reason_internal(uuid,text)') is null then
    if to_regprocedure('public.reverse_correction_decree_with_reason(uuid,text)') is null then
      raise exception 'Falta reverse_correction_decree_with_reason canónica';
    end if;
    execute 'alter function public.reverse_correction_decree_with_reason(uuid,text) rename to reverse_correction_decree_with_reason_internal';
  end if;
  if to_regprocedure('public.reverse_replacement_decree_with_reason_internal(uuid,text)') is null then
    if to_regprocedure('public.reverse_replacement_decree_with_reason(uuid,text)') is null then
      raise exception 'Falta reverse_replacement_decree_with_reason canónica';
    end if;
    execute 'alter function public.reverse_replacement_decree_with_reason(uuid,text) rename to reverse_replacement_decree_with_reason_internal';
  end if;
end;
$$;

create or replace function public.reverse_correction_decree_with_reason(p_decree_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$declare
  v_parish_id uuid;
begin
  select parish_id into v_parish_id from public.decretos where id=p_decree_id;
  if v_parish_id is null then raise exception 'Decreto no encontrado'; end if;
  perform public.sacramentum_assert_chancery_for_parish(v_parish_id);
  return public.reverse_correction_decree_with_reason_internal(p_decree_id,p_reason);
end;
$$;

create or replace function public.reverse_replacement_decree_with_reason(p_decree_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_parish_id uuid;
begin
  select parish_id into v_parish_id from public.decretos where id=p_decree_id;
  if v_parish_id is null then raise exception 'Decreto no encontrado'; end if;
  perform public.sacramentum_assert_chancery_for_parish(v_parish_id);
  return public.reverse_replacement_decree_with_reason_internal(p_decree_id,p_reason);
end;
$$;

revoke all on function public.reverse_correction_decree_with_reason_internal(uuid,text) from public,anon,authenticated;
revoke all on function public.reverse_replacement_decree_with_reason_internal(uuid,text) from public,anon,authenticated;
grant execute on function public.reverse_correction_decree_with_reason_internal(uuid,text) to service_role;
grant execute on function public.reverse_replacement_decree_with_reason_internal(uuid,text) to service_role;revoke all on function public.reverse_correction_decree(uuid) from public,anon,authenticated;
revoke all on function public.reverse_replacement_decree(uuid) from public,anon,authenticated;
grant execute on function public.reverse_correction_decree(uuid) to service_role;
grant execute on function public.reverse_replacement_decree(uuid) to service_role;

revoke all on function public.reverse_correction_decree_with_reason(uuid,text) from public,anon;
revoke all on function public.reverse_replacement_decree_with_reason(uuid,text) from public,anon;
grant execute on function public.reverse_correction_decree_with_reason(uuid,text) to authenticated,service_role;
grant execute on function public.reverse_replacement_decree_with_reason(uuid,text) to authenticated,service_role;

comment on function public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)
is 'Entrada pública protegida: sólo Cancillería activa de la misma diócesis puede emitir correcciones de Bautismo.';
comment on function public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)
is 'Entrada pública protegida: sólo Cancillería activa de la misma diócesis puede emitir reposiciones de Bautismo con evidencia.';

commit;

select jsonb_pretty(jsonb_build_object(
  'correction_wrapper',to_regprocedure('public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)') is not null,
  'replacement_wrapper',to_regprocedure('public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)') is not null,
  'correction_internal',to_regprocedure('public.apply_baptism_correction_internal(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)') is not null,
  'replacement_internal',to_regprocedure('public.apply_baptism_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)') is not null,
  'anon_apply_correction',has_function_privilege('anon','public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)','EXECUTE'),
  'anon_apply_replacement',has_function_privilege('anon','public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)','EXECUTE'),  'auth_apply_correction',has_function_privilege('authenticated','public.apply_baptism_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)','EXECUTE'),
  'auth_apply_replacement',has_function_privilege('authenticated','public.apply_baptism_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)','EXECUTE'),
  'auth_legacy_reverse_correction',has_function_privilege('authenticated','public.reverse_correction_decree(uuid)','EXECUTE'),
  'auth_legacy_reverse_replacement',has_function_privilege('authenticated','public.reverse_replacement_decree(uuid)','EXECUTE'),
  'auth_reason_reverse_correction',has_function_privilege('authenticated','public.reverse_correction_decree_with_reason(uuid,text)','EXECUTE'),
  'auth_reason_reverse_replacement',has_function_privilege('authenticated','public.reverse_replacement_decree_with_reason(uuid,text)','EXECUTE'),
  'guard_trigger_enabled',exists(
    select 1 from pg_trigger t
    where t.tgrelid='public.decretos'::regclass
      and t.tgname='trg_sacramentum_guard_decree_authority'
      and t.tgenabled<>'D'
  )
)) as authority_postcheck;