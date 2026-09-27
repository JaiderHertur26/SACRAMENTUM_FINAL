-- SACRAMENTUM V74 · saneamiento auditado de Confirmaciones legacy mal asignadas.
create or replace function public.reconcile_legacy_confirmation_shadows_v74(
  p_shadow_parish_id uuid,
  p_correct_parish_id uuid,
  p_source_parish_pattern text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text;
  v_diocese uuid;
  v_shadow_diocese uuid;
  v_correct_diocese uuid;
  v_row record;
  v_removed integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_shadow_parish_id is null or p_correct_parish_id is null then
    raise exception 'Las parroquias son obligatorias';
  end if;
  if nullif(trim(coalesce(p_source_parish_pattern,'')),'') is null then
    raise exception 'El patrón de parroquia fuente es obligatorio';
  end if;

  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();

  select diocese_id into v_shadow_diocese from public.parishes where id=p_shadow_parish_id;
  select diocese_id into v_correct_diocese from public.parishes where id=p_correct_parish_id;
  if v_shadow_diocese is null or v_correct_diocese is null then raise exception 'Parroquia no encontrada'; end if;
  if v_shadow_diocese is distinct from v_correct_diocese then raise exception 'Las parroquias deben pertenecer a la misma jurisdicción'; end if;
  if v_role='diocese' and v_diocese is distinct from v_shadow_diocese then
    raise exception 'La operación pertenece a otra jurisdicción';
  elsif v_role not in ('diocese','admin_general') then
    raise exception 'No autorizado';
  end if;

  for v_row in
    select s.*,c.id correct_confirmation_id
    from public.confirmations s
    join public.confirmations c
      on c.parish_id=p_correct_parish_id
     and c.book_number=s.book_number
     and c.folio=s.folio
     and c.number=s.number
     and upper(trim(coalesce(c.nombres,'')))=upper(trim(coalesce(s.nombres,'')))
     and upper(trim(coalesce(c.apellidos,'')))=upper(trim(coalesce(s.apellidos,'')))
     and c.celebration_date is not distinct from s.celebration_date
    where s.parish_id=p_shadow_parish_id
      and upper(coalesce(s.raw_data->>'source_parish_name',s.raw_data->>'lugcon',''))
          like '%'||upper(trim(p_source_parish_pattern))||'%'
  loop
    insert into public.registry_audit_log(
      actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata
    ) values (
      auth.uid(),p_shadow_parish_id,v_shadow_diocese,'confirmation',v_row.id,
      'remove_reconciled_legacy_confirmation_shadow_v74',
      to_jsonb(v_row)-'correct_confirmation_id',
      jsonb_build_object('correct_confirmation_id',v_row.correct_confirmation_id),
      jsonb_build_object(
        'shadow_parish_id',p_shadow_parish_id,
        'correct_parish_id',p_correct_parish_id,
        'source_parish_pattern',p_source_parish_pattern,
        'legacy_archive_preserved',true,
        'physical_archive_preserved',true
      )
    );

    delete from public.confirmations where id=v_row.id;
    v_removed:=v_removed+1;
  end loop;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,action,after_data,metadata
  ) values (
    auth.uid(),p_shadow_parish_id,v_shadow_diocese,'legacy_reconciliation',
    'reconcile_legacy_confirmation_shadows_v74',
    jsonb_build_object('removed_shadows',v_removed),
    jsonb_build_object(
      'shadow_parish_id',p_shadow_parish_id,
      'correct_parish_id',p_correct_parish_id,
      'source_parish_pattern',p_source_parish_pattern,
      'legacy_archive_preserved',true
    )
  );

  return jsonb_build_object(
    'shadow_parish_id',p_shadow_parish_id,
    'correct_parish_id',p_correct_parish_id,
    'removed_shadows',v_removed
  );
end;
$$;

revoke all on function public.reconcile_legacy_confirmation_shadows_v74(uuid,uuid,text)
from public,anon;
grant execute on function public.reconcile_legacy_confirmation_shadows_v74(uuid,uuid,text)
to authenticated;

comment on function public.reconcile_legacy_confirmation_shadows_v74(uuid,uuid,text) is
'Retira Confirmaciones legacy canónicas mal asignadas sólo cuando existe contraparte exacta en la parroquia correcta; conserva archivo y evidencia física y audita cada retiro.';
