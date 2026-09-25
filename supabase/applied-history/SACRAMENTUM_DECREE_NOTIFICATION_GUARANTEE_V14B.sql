-- SACRAMENTUM · V14B
-- Garantía central: todo decreto ejecutado para una parroquia genera
-- exactamente una notificación oficial, aun si el RPC concreto no la inserta.

begin;

create or replace function public.sacramentum_emit_decree_notification()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_diocese uuid;
  v_chancery uuid;
  v_actor_role text;
  v_sacrament text;
  v_sacrament_label text;
  v_type text;
  v_type_label text;
  v_subject text;
  v_message text;
  v_number text;
begin
  if new.parish_id is null then
    return new;
  end if;

  if lower(coalesce(new.status,'active')) <> 'active' then
    return new;
  end if;

  if exists (
    select 1
    from public.official_notifications n
    where n.decree_id=new.id
      and n.receiver_parish_id=new.parish_id
      and n.category='decree'
  ) then
    return new;
  end if;

  select lower(coalesce(up.role,''))
    into v_actor_role
  from public.user_profiles up
  where up.auth_user_id=coalesce(new.issued_by,auth.uid())
    and coalesce(up.is_active,true)=true
  limit 1;

  -- En ejecución normal exigimos autoridad de Cancillería/Diócesis/Admin.
  -- En tareas de servicio se admite también un chancery_id explícito.
  if coalesce(v_actor_role,'') not in ('chancery','diocese','admin_general')
     and new.chancery_id is null then
    return new;
  end if;

  select coalesce(new.diocese_id,p.diocese_id)
    into v_diocese
  from public.parishes p
  where p.id=new.parish_id;

  v_chancery := new.chancery_id;
  if v_chancery is null and v_diocese is not null then
    select c.id into v_chancery
    from public.chancelleries c
    where c.diocese_id=v_diocese
    order by c.id
    limit 1;
  end if;

  v_sacrament := lower(coalesce(
    nullif(new.sacrament_type,''),
    nullif(new.payload->>'sacramentType',''),
    nullif(new.payload->>'sacramento',''),
    'sacramento'
  ));

  v_type := lower(coalesce(
    nullif(new.tipo,''),
    nullif(new.payload->>'decreeType',''),
    'decreto'
  ));

  v_sacrament_label := case v_sacrament
    when 'bautismo' then 'Bautismo'
    when 'confirmacion' then 'Confirmación'
    when 'confirmación' then 'Confirmación'
    when 'matrimonio' then 'Matrimonio'
    when 'exequias' then 'Exequias'
    when 'funeral' then 'Exequias'
    else initcap(v_sacrament)
  end;

  v_type_label := case v_type
    when 'correccion' then 'corrección'
    when 'correction' then 'corrección'
    when 'reposicion' then 'reposición'
    when 'replacement' then 'reposición'
    when 'nulidad' then 'nulidad'
    when 'nullity' then 'nulidad'
    else replace(v_type,'_',' ')
  end;

  v_number := coalesce(
    nullif(new.decree_number,''),
    nullif(new.payload->>'decreeNumber',''),
    nullif(new.payload->>'numeroDecreto',''),
    'S/N'
  );

  v_subject := 'Decreto de ' || v_type_label || ' de ' || v_sacrament_label || ' ' || v_number;
  v_message := 'Cancillería ha ejecutado un decreto de ' || v_type_label ||
    ' relacionado con ' || v_sacrament_label ||
    ' para esta parroquia. Abra esta comunicación para consultar el decreto completo.';

  insert into public.official_notifications(
    diocese_id,
    sender_chancery_id,
    receiver_parish_id,
    decree_id,
    category,
    subject,
    message,
    status,
    payload,
    created_by
  ) values (
    v_diocese,
    v_chancery,
    new.parish_id,
    new.id,
    'decree',
    v_subject,
    v_message,
    'pending',
    coalesce(new.payload,'{}'::jsonb) || jsonb_build_object(
      'sacramentType',v_sacrament,
      'decreeType',v_type,
      'decreeNumber',v_number,
      'decreeDate',new.decree_date,
      'decreeId',new.id,
      'notificationGuaranteed',true
    ),
    coalesce(new.issued_by,auth.uid())
  )
  on conflict (decree_id,receiver_parish_id,category)
    where decree_id is not null
  do nothing;

  return new;
end;
$$;

revoke all on function public.sacramentum_emit_decree_notification() from public;
grant execute on function public.sacramentum_emit_decree_notification() to authenticated;
grant execute on function public.sacramentum_emit_decree_notification() to service_role;

drop trigger if exists trg_decree_official_notification_guarantee
  on public.decretos;

create constraint trigger trg_decree_official_notification_guarantee
after insert or update on public.decretos
deferrable initially deferred
for each row
execute function public.sacramentum_emit_decree_notification();

commit;
