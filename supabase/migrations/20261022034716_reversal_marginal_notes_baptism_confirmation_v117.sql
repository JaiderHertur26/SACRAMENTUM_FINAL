-- SACRAMENTUM V117: Las reversiones de Bautismo y Confirmación se asientan como nuevas notas marginales.
-- El sistema conserva las notas originales revertidas y rechaza duplicar la reversión.
-- reverse_correction_decree_with_reason_internal; fuente completa, conserva SECURITY DEFINER y permisos anteriores.
CREATE OR REPLACE FUNCTION public.reverse_correction_decree_with_reason_internal(p_decree_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF lower(coalesce(v_before.status,'')) = 'reversed' THEN
    RAISE EXCEPTION 'El decreto ya fue revertido; se prohíben segundas anotaciones';
  END IF;
  v_result := public.reverse_correction_decree(p_decree_id);
  IF v_result IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'No quedó confirmada la reversión del decreto';
  END IF;
  IF v_before.original_record_id IS NULL OR v_before.replacement_record_id IS NULL THEN
    RAISE EXCEPTION 'Reversión de corrección sin par original/supletoria';
  END IF;
  INSERT INTO public.marginal_notes(sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,source_type,source_id,decree_id,created_by,status,print_policy)
  VALUES
    (CASE WHEN lower(coalesce(v_sacrament,'')) IN ('bautismo','baptism','bautismos') THEN 'bautismo' ELSE 'confirmacion' END,'reversion_correccion_original',v_before.decree_number,
     'REVERSIÓN DEL DECRETO '||coalesce(v_before.decree_number,'SIN NÚMERO')||' DEL '||current_date::text||'. MOTIVO: '||upper(v_reason)||'. LA PARTIDA ORIGINAL RECUPERA VIGENCIA.',
     v_before.parish_id,v_before.original_record_id,current_date,
     'decree',p_decree_id,p_decree_id,auth.uid(),'active','required'),
    (CASE WHEN lower(coalesce(v_sacrament,'')) IN ('bautismo','baptism','bautismos') THEN 'bautismo' ELSE 'confirmacion' END,'reversion_correccion_supletoria',v_before.decree_number,
     'REVERSIÓN DEL DECRETO '||coalesce(v_before.decree_number,'SIN NÚMERO')||' DEL '||current_date::text||'. MOTIVO: '||upper(v_reason)||'. LA PARTIDA SUPLETORIA QUEDA SIN EFECTO.',
     v_before.parish_id,v_before.replacement_record_id,current_date,
     'decree',p_decree_id,p_decree_id,auth.uid(),'active','required');

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
$function$
;

-- reverse_replacement_decree_with_reason_internal; fuente completa, conserva SECURITY DEFINER y permisos anteriores.
CREATE OR REPLACE FUNCTION public.reverse_replacement_decree_with_reason_internal(p_decree_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF lower(coalesce(v_before.status,'')) = 'reversed' THEN
    RAISE EXCEPTION 'El decreto ya fue revertido; se prohíben segundas anotaciones';
  END IF;
  v_result := public.reverse_replacement_decree(p_decree_id);
  IF v_result IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'No quedó confirmada la reversión del decreto';
  END IF;
  IF v_before.original_record_id IS NOT NULL OR v_before.replacement_record_id IS NULL THEN
    RAISE EXCEPTION 'Reversión de reposición sin partida supletoria única';
  END IF;
  INSERT INTO public.marginal_notes(sacrament_type,note_type,decree_number,content,parish_id,sacrament_id,note_date,source_type,source_id,decree_id,created_by,status,print_policy)
  VALUES
    (CASE WHEN lower(coalesce(v_sacrament,'')) IN ('bautismo','baptism','bautismos') THEN 'bautismo' ELSE 'confirmacion' END,'reversion_reposicion',v_before.decree_number,
     'REVERSIÓN DEL DECRETO '||coalesce(v_before.decree_number,'SIN NÚMERO')||' DEL '||current_date::text||'. MOTIVO: '||upper(v_reason)||'. LA PARTIDA SUPLETORIA QUEDA SIN EFECTO. NO EXISTE ORIGINAL QUE RESTITUIR.',
     v_before.parish_id,v_before.replacement_record_id,current_date,
     'decree',p_decree_id,p_decree_id,auth.uid(),'active','required');

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
$function$
;
