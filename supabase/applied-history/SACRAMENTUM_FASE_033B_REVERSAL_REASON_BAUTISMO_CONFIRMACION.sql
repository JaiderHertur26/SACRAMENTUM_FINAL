-- SACRAMENTUM · FASE 033B
-- BAUTISMO / CONFIRMACIÓN · REVERSIÓN AUDITADA CON MOTIVO
-- Complementa las RPC históricas SIN cambiar su lógica transaccional.
-- Fecha: 2026-09-13
--
-- OBJETIVO
-- 1. Conservar el motivo escrito por Cancillería al revertir una Corrección.
-- 2. Conservar el motivo escrito por Cancillería al revertir una Reposición.
-- 3. Mantener intactas las RPC históricas reverse_correction_decree(uuid)
--    y reverse_replacement_decree(uuid), que siguen realizando la reversión real.
-- 4. No reutilizar consecutivos.
-- 5. No intervenir Matrimonio ni Exequias: poseen RPC canónicas propias.
--
-- ESTA MIGRACIÓN NO REVIERTE NINGÚN DECRETO POR SÍ SOLA.

begin;

-- ---------------------------------------------------------------------------
-- 0. PRECONDICIONES
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.reverse_correction_decree(uuid)') is null then
    raise exception '033B abortada: falta public.reverse_correction_decree(uuid)';
  end if;

  if to_regprocedure('public.reverse_replacement_decree(uuid)') is null then
    raise exception '033B abortada: falta public.reverse_replacement_decree(uuid)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. CORRECCIÓN · wrapper con motivo obligatorio
-- ---------------------------------------------------------------------------
create or replace function public.reverse_correction_decree_with_reason(
  p_decree_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_user_diocese uuid;
  v_before public.decretos%rowtype;
  v_after public.decretos%rowtype;
  v_sacrament text;
  v_reason text;
  v_result boolean;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  v_reason := nullif(trim(coalesce(p_reason,'')),'');
  if v_reason is null then
    raise exception 'El motivo de reversión es obligatorio';
  end if;

  select lower(coalesce(up.role,'')), up.diocese_id
    into v_role, v_user_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Rol no autorizado para revertir decretos';
  end if;

  select d.*
    into v_before
  from public.decretos d
  where d.id = p_decree_id
  for update;

  if not found then
    raise exception 'Decreto no encontrado';
  end if;

  if lower(coalesce(v_before.tipo,'')) <> 'correccion' then
    raise exception 'El decreto no corresponde a una corrección';
  end if;

  v_sacrament := lower(coalesce(
    v_before.sacrament_type,
    v_before.payload->>'sacramentType',
    v_before.payload->>'sacramento',
    ''
  ));

  if v_sacrament not in (
    'bautismo','baptism','bautismos',
    'confirmacion','confirmation','confirmaciones'
  ) then
    raise exception 'La RPC 033B sólo aplica a Bautismo y Confirmación. Sacramento: %', v_sacrament;
  end if;

  if v_role <> 'admin_general'
     and v_user_diocese is distinct from v_before.diocese_id then
    raise exception 'El decreto no pertenece a la jurisdicción del usuario';
  end if;

  -- La función histórica conserva toda su lógica de restauración y no reutiliza
  -- el consecutivo. Al ejecutarse dentro de esta misma transacción, cualquier
  -- fallo posterior revierte también sus cambios.
  v_result := public.reverse_correction_decree(p_decree_id);

  update public.decretos d
  set payload = coalesce(d.payload,'{}'::jsonb) || jsonb_build_object(
      'reversalReason', v_reason,
      'reversalRecordedAt', now(),
      'reversalRecordedBy', auth.uid()
    )
  where d.id = p_decree_id;

  select d.* into v_after
  from public.decretos d
  where d.id = p_decree_id;

  insert into public.registry_audit_log(
    actor_user_id,
    parish_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    metadata
  )
  values(
    auth.uid(),
    v_before.parish_id,
    v_before.diocese_id,
    'decree',
    p_decree_id,
    'reversal_reason_recorded',
    to_jsonb(v_before),
    coalesce(to_jsonb(v_after), jsonb_build_object('status','reversed')),
    jsonb_build_object(
      'reason', v_reason,
      'sacrament_type', v_sacrament,
      'decree_type', 'correccion',
      'sequence_reused', false
    )
  );

  return jsonb_build_object(
    'decree_id', p_decree_id,
    'status', coalesce(v_after.status,'reversed'),
    'reversal_reason', v_reason,
    'legacy_reverse_result', coalesce(v_result,false)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. REPOSICIÓN · wrapper con motivo obligatorio
-- ---------------------------------------------------------------------------
create or replace function public.reverse_replacement_decree_with_reason(
  p_decree_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_user_diocese uuid;
  v_before public.decretos%rowtype;
  v_after public.decretos%rowtype;
  v_sacrament text;
  v_reason text;
  v_result boolean;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  v_reason := nullif(trim(coalesce(p_reason,'')),'');
  if v_reason is null then
    raise exception 'El motivo de reversión es obligatorio';
  end if;

  select lower(coalesce(up.role,'')), up.diocese_id
    into v_role, v_user_diocese
  from public.user_profiles up
  where up.auth_user_id = auth.uid()
    and coalesce(up.is_active,true) = true
    and coalesce(up.status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role not in ('chancery','diocese','admin_general') then
    raise exception 'Rol no autorizado para revertir decretos';
  end if;

  select d.*
    into v_before
  from public.decretos d
  where d.id = p_decree_id
  for update;

  if not found then
    raise exception 'Decreto de reposición no encontrado';
  end if;

  if lower(coalesce(v_before.tipo,'')) <> 'reposicion' then
    raise exception 'El decreto no corresponde a una reposición';
  end if;

  v_sacrament := lower(coalesce(
    v_before.sacrament_type,
    v_before.payload->>'sacramentType',
    v_before.payload->>'sacramento',
    ''
  ));

  if v_sacrament not in (
    'bautismo','baptism','bautismos',
    'confirmacion','confirmation','confirmaciones'
  ) then
    raise exception 'La RPC 033B sólo aplica a Bautismo y Confirmación. Sacramento: %', v_sacrament;
  end if;

  if v_role <> 'admin_general'
     and v_user_diocese is distinct from v_before.diocese_id then
    raise exception 'El decreto no pertenece a la jurisdicción del usuario';
  end if;

  v_result := public.reverse_replacement_decree(p_decree_id);

  update public.decretos d
  set payload = coalesce(d.payload,'{}'::jsonb) || jsonb_build_object(
      'reversalReason', v_reason,
      'reversalRecordedAt', now(),
      'reversalRecordedBy', auth.uid()
    )
  where d.id = p_decree_id;

  select d.* into v_after
  from public.decretos d
  where d.id = p_decree_id;

  insert into public.registry_audit_log(
    actor_user_id,
    parish_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    metadata
  )
  values(
    auth.uid(),
    v_before.parish_id,
    v_before.diocese_id,
    'decree',
    p_decree_id,
    'reversal_reason_recorded',
    to_jsonb(v_before),
    coalesce(to_jsonb(v_after), jsonb_build_object('status','reversed')),
    jsonb_build_object(
      'reason', v_reason,
      'sacrament_type', v_sacrament,
      'decree_type', 'reposicion',
      'sequence_reused', false
    )
  );

  return jsonb_build_object(
    'decree_id', p_decree_id,
    'status', coalesce(v_after.status,'reversed'),
    'reversal_reason', v_reason,
    'legacy_reverse_result', coalesce(v_result,false)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. PRIVILEGIOS
-- ---------------------------------------------------------------------------
revoke all on function public.reverse_correction_decree_with_reason(uuid,text) from public;
revoke all on function public.reverse_correction_decree_with_reason(uuid,text) from anon;
grant execute on function public.reverse_correction_decree_with_reason(uuid,text) to authenticated;
grant execute on function public.reverse_correction_decree_with_reason(uuid,text) to service_role;

revoke all on function public.reverse_replacement_decree_with_reason(uuid,text) from public;
revoke all on function public.reverse_replacement_decree_with_reason(uuid,text) from anon;
grant execute on function public.reverse_replacement_decree_with_reason(uuid,text) to authenticated;
grant execute on function public.reverse_replacement_decree_with_reason(uuid,text) to service_role;

commit;

-- ---------------------------------------------------------------------------
-- POSTCHECK · SOLO LECTURA
-- ---------------------------------------------------------------------------
select jsonb_pretty(
  jsonb_build_object(
    'legacy_correction_reverse_preserved',
      to_regprocedure('public.reverse_correction_decree(uuid)') is not null,
    'legacy_replacement_reverse_preserved',
      to_regprocedure('public.reverse_replacement_decree(uuid)') is not null,

    'correction_reason_wrapper_ok',
      to_regprocedure('public.reverse_correction_decree_with_reason(uuid,text)') is not null,
    'replacement_reason_wrapper_ok',
      to_regprocedure('public.reverse_replacement_decree_with_reason(uuid,text)') is not null,

    'correction_reason_security_definer',
      coalesce((
        select p.prosecdef from pg_proc p
        where p.oid = to_regprocedure('public.reverse_correction_decree_with_reason(uuid,text)')
      ), false),
    'replacement_reason_security_definer',
      coalesce((
        select p.prosecdef from pg_proc p
        where p.oid = to_regprocedure('public.reverse_replacement_decree_with_reason(uuid,text)')
      ), false),

    'anon_correction_reason_execute',
      has_function_privilege('anon','public.reverse_correction_decree_with_reason(uuid,text)','EXECUTE'),
    'anon_replacement_reason_execute',
      has_function_privilege('anon','public.reverse_replacement_decree_with_reason(uuid,text)','EXECUTE'),

    'authenticated_correction_reason_execute',
      has_function_privilege('authenticated','public.reverse_correction_decree_with_reason(uuid,text)','EXECUTE'),
    'authenticated_replacement_reason_execute',
      has_function_privilege('authenticated','public.reverse_replacement_decree_with_reason(uuid,text)','EXECUTE'),

    'service_role_correction_reason_execute',
      has_function_privilege('service_role','public.reverse_correction_decree_with_reason(uuid,text)','EXECUTE'),
    'service_role_replacement_reason_execute',
      has_function_privilege('service_role','public.reverse_replacement_decree_with_reason(uuid,text)','EXECUTE')
  )
) as fase033b_reversal_postcheck;
