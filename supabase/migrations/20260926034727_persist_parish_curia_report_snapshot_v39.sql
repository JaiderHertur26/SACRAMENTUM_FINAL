create or replace function public.attach_parish_curia_report_snapshot(
  p_report_id uuid,
  p_curia_breakdown jsonb default '{}'::jsonb,
  p_pastoral_supplement jsonb default '{}'::jsonb,
  p_age_ranges jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_diocese uuid;
  v_role text;
  v_report_number text;
begin
  select public.current_app_diocese_id(), public.current_app_role()
    into v_diocese, v_role;

  if auth.uid() is null or v_role not in ('diocese', 'admin_general') then
    raise exception 'No autorizado para adjuntar el detalle del informe';
  end if;

  if v_diocese is null then
    raise exception 'No se pudo determinar la diócesis del usuario';
  end if;
  select report_number into v_report_number
  from public.diocesan_report_runs
  where id = p_report_id
    and diocese_id = v_diocese;

  if v_report_number is null then
    raise exception 'Informe fuera de la jurisdicción';
  end if;

  update public.diocesan_report_runs
  set
    filters = coalesce(filters, '{}'::jsonb)
      || jsonb_build_object(
        'report_profile', 'parish_curia',
        'age_ranges', coalesce(p_age_ranges, '[]'::jsonb)
      ),
    summary = coalesce(summary, '{}'::jsonb)
      || jsonb_build_object(
        'curia_breakdown', coalesce(p_curia_breakdown, '{}'::jsonb),
        'pastoral_supplement', coalesce(p_pastoral_supplement, '{}'::jsonb)
      )
  where id = p_report_id
    and diocese_id = v_diocese;
  insert into public.registry_audit_log(
    actor_user_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    after_data,
    metadata
  )
  values (
    auth.uid(),
    v_diocese,
    'diocesan_report',
    p_report_id,
    'attach_parish_curia_report_snapshot',
    jsonb_build_object(
      'curia_breakdown', coalesce(p_curia_breakdown, '{}'::jsonb),
      'pastoral_supplement', coalesce(p_pastoral_supplement, '{}'::jsonb)
    ),
    jsonb_build_object(
      'report_number', v_report_number,
      'age_ranges', coalesce(p_age_ranges, '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.attach_parish_curia_report_snapshot(uuid, jsonb, jsonb, jsonb) from public;
revoke all on function public.attach_parish_curia_report_snapshot(uuid, jsonb, jsonb, jsonb) from anon;
grant execute on function public.attach_parish_curia_report_snapshot(uuid, jsonb, jsonb, jsonb) to authenticated;

comment on function public.attach_parish_curia_report_snapshot(uuid, jsonb, jsonb, jsonb)
is 'Adjunta al informe diocesano el snapshot parroquial de Curia y los datos pastorales complementarios.';
