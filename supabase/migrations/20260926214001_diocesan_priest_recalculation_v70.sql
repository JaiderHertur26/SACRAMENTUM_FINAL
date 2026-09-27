-- SACRAMENTUM V70 · permite recálculo histórico de párrocos a la Diócesis propietaria.
create or replace function public.sacramentum_recalculate_current_priest(p_parish_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_current uuid;
  v_role text;
  v_user_diocese uuid;
  v_parish_diocese uuid;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;
  if p_parish_id is null then
    raise exception 'Parroquia requerida';
  end if;

  select p.diocese_id into v_parish_diocese
  from public.parishes p
  where p.id=p_parish_id;

  if v_parish_diocese is null then
    raise exception 'Parroquia no encontrada o sin Diócesis/Arquidiócesis';
  end if;

  v_role:=public.current_app_role();
  v_user_diocese:=public.current_app_diocese_id();

  if not (
    public.is_app_admin()
    or (
      v_role='parish'
      and public.current_app_parish_id()=p_parish_id
    )
    or (
      v_role='diocese'
      and v_user_diocese=v_parish_diocese
    )
  ) then
    raise exception 'No autorizado para recalcular el párroco actual de esta parroquia';
  end if;

  select p.id into v_current
  from public.parrocos p
  where p.parish_id=p_parish_id
  order by p.fecha_ingreso desc nulls last,p.created_at desc,p.id desc
  limit 1;

  update public.parrocos
  set estado=case when id=v_current then 'ACTIVO' else 'HISTORICO' end
  where parish_id=p_parish_id;
end;
$$;

comment on function public.sacramentum_recalculate_current_priest(uuid) is
'Recalcula el párroco vigente; además de la propia parroquia, permite a la Diócesis propietaria ejecutar el recálculo durante migraciones legacy auditadas.';
