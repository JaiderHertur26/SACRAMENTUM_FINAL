-- SACRAMENTUM · CONFIRMACIÓN · AUTORIDAD ESTRICTA DE CANCILLERÍA
-- Reutiliza el guard institucional ya instalado durante el cierre de Bautismo.
begin;

do $$
begin
  if to_regprocedure('public.sacramentum_assert_chancery_for_parish(uuid)') is null then
    raise exception 'Falta el guard canónico de autoridad de Cancillería';
  end if;
  if to_regprocedure('public.apply_confirmation_correction_internal(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)') is null then
    if to_regprocedure('public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)') is null then
      raise exception 'Falta apply_confirmation_correction canónica';
    end if;
    alter function public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)
      rename to apply_confirmation_correction_internal;
  end if;
  if to_regprocedure('public.apply_confirmation_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)') is null then
    if to_regprocedure('public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)') is null then
      raise exception 'Falta apply_confirmation_replacement canónica';
    end if;
    alter function public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)
      rename to apply_confirmation_replacement_internal;
  end if;
end $$;

create or replace function public.apply_confirmation_correction(
  p_parish_id uuid,p_original_confirmation_id uuid,p_decree_number text,p_decree_date date,
  p_concept_id uuid,p_corrected_data jsonb,p_decree_payload jsonb,
  p_annulled_note text,p_replacement_note text,
  p_expected_book integer,p_expected_folio integer,p_expected_number integer
)returns table(decree_id uuid,replacement_confirmation_id uuid,book_number text,folio text,number text)
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
  if nullif(trim(coalesce(p_decree_number,'')),'') is null or p_decree_date is null then
    raise exception 'Número y fecha del decreto son obligatorios';
  end if;
  if p_decree_date>current_date then raise exception 'La fecha del decreto no puede ser futura'; end if;
  v_reason:=nullif(trim(coalesce(p_decree_payload->>'reason',p_decree_payload->>'fundamento','')),'');
  if v_reason is null then raise exception 'El fundamento de la corrección es obligatorio'; end if;
  if nullif(trim(coalesce(p_annulled_note,'')),'') is null
     or nullif(trim(coalesce(p_replacement_note,'')),'') is null then
    raise exception 'Las notas marginales de corrección son obligatorias';
  end if;

  select lower(coalesce(c.status,'')) into v_status
  from public.confirmations c
  where c.id=p_original_confirmation_id and c.parish_id=p_parish_id;
  if not found then raise exception 'La partida original no existe en la parroquia seleccionada'; end if;
  if v_status in ('anulada','annulled','reversed','revertida','replaced','deleted') then
    raise exception 'La partida original no está vigente para una nueva corrección';
  end if;

  select coalesce((pp.confirmaciones_params->>'suplementarioBlocked')::boolean,false)
    into v_blocked from public.parish_parameters pp where pp.parish_id=p_parish_id;
  if v_blocked then raise exception 'El Libro Supletorio de Confirmación está bloqueado'; end if;  return query select * from public.apply_confirmation_correction_internal(
    p_parish_id,p_original_confirmation_id,p_decree_number,p_decree_date,p_concept_id,
    p_corrected_data,p_decree_payload,p_annulled_note,p_replacement_note,
    p_expected_book,p_expected_folio,p_expected_number
  );
end;
$$;

create or replace function public.apply_confirmation_replacement(
  p_parish_id uuid,p_decree_number text,p_decree_date date,p_concept_id uuid,
  p_new_data jsonb,p_decree_payload jsonb,p_replacement_note text,
  p_expected_book integer,p_expected_folio integer,p_expected_number integer
)
returns table(decree_id uuid,replacement_confirmation_id uuid,book_number text,folio text,number text)
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
  if p_concept_id is null then raise exception 'El concepto del decreto de reposición es obligatorio'; end if;
  if nullif(trim(coalesce(p_decree_number,'')),'') is null or p_decree_date is null then
    raise exception 'Número y fecha del decreto son obligatorios';
  end if;
  if p_decree_date>current_date then raise exception 'La fecha del decreto no puede ser futura'; end if;
  v_reason:=nullif(trim(coalesce(p_new_data->>'reason',p_new_data->>'fundamento',p_decree_payload->>'reason',p_decree_payload->>'fundamento','')),'');
  if v_reason is null then raise exception 'El fundamento de la reposición es obligatorio'; end if;  v_evidence:=coalesce(p_new_data->'decreeEvidence',p_decree_payload->'evidence','{}'::jsonb);
  if jsonb_typeof(v_evidence)<>'object'
     or nullif(trim(coalesce(v_evidence->>'type','')),'') is null
     or nullif(trim(coalesce(v_evidence->>'reference','')),'') is null
     or nullif(trim(coalesce(v_evidence->>'issuer','')),'') is null
     or nullif(trim(coalesce(v_evidence->>'description','')),'') is null then
    raise exception 'La reposición exige evidencia identificada: tipo, referencia, emisor/custodio y descripción';
  end if;
  if nullif(trim(coalesce(p_replacement_note,'')),'') is null then
    raise exception 'La nota marginal de reposición es obligatoria';
  end if;

  select coalesce((pp.confirmaciones_params->>'suplementarioBlocked')::boolean,false)
    into v_blocked from public.parish_parameters pp where pp.parish_id=p_parish_id;
  if v_blocked then raise exception 'El Libro Supletorio de Confirmación está bloqueado'; end if;

  return query select * from public.apply_confirmation_replacement_internal(
    p_parish_id,p_decree_number,p_decree_date,p_concept_id,p_new_data,
    p_decree_payload,p_replacement_note,p_expected_book,p_expected_folio,p_expected_number
  );
end;
$$;

revoke all on function public.apply_confirmation_correction_internal(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.apply_confirmation_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.apply_confirmation_correction_internal(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) to service_role;
grant execute on function public.apply_confirmation_replacement_internal(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) to service_role;
revoke all on function public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) from public,anon;
revoke all on function public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) from public,anon;
grant execute on function public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer) to authenticated,service_role;
grant execute on function public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer) to authenticated,service_role;

-- Los demás RPC públicos de Confirmación también quedan cerrados a anon.
revoke all on function public.create_pending_confirmation(uuid,jsonb) from public,anon;
grant execute on function public.create_pending_confirmation(uuid,jsonb) to authenticated,service_role;

comment on function public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)
is 'Entrada protegida: sólo Cancillería activa de la misma diócesis puede emitir correcciones de Confirmación.';
comment on function public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)
is 'Entrada protegida: sólo Cancillería activa de la misma diócesis puede emitir reposiciones de Confirmación con evidencia.';

commit;

select jsonb_pretty(jsonb_build_object(
  'anon_pending',has_function_privilege('anon','public.create_pending_confirmation(uuid,jsonb)','EXECUTE'),
  'anon_correction',has_function_privilege('anon','public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)','EXECUTE'),
  'anon_replacement',has_function_privilege('anon','public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)','EXECUTE'),
  'auth_correction',has_function_privilege('authenticated','public.apply_confirmation_correction(uuid,uuid,text,date,uuid,jsonb,jsonb,text,text,integer,integer,integer)','EXECUTE'),
  'auth_replacement',has_function_privilege('authenticated','public.apply_confirmation_replacement(uuid,text,date,uuid,jsonb,jsonb,text,integer,integer,integer)','EXECUTE')
)) as confirmation_authority_postcheck;