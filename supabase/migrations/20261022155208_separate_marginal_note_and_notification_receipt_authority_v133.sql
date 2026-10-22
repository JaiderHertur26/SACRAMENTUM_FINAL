-- V133 · Custodia de notas y acuse: Admin General no altera libros; sólo parroquia destinataria confirma leído/archivado.
-- archive_official_notification · V133
CREATE OR REPLACE FUNCTION public.archive_official_notification(p_notification_id uuid)
 RETURNS official_notifications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.official_notifications%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_row
  from public.official_notifications
  where id = p_notification_id
  for update;

  if not found then raise exception 'Notificación no encontrada'; end if;

  if not (
    (public.current_app_role()='parish' and v_row.receiver_parish_id=public.current_app_parish_id())
  ) then
    raise exception 'Sólo la parroquia destinataria puede archivar esta comunicación';
  end if;

  update public.official_notifications
  set status='archived',
      read_at=coalesce(read_at,now()),
      processed_at=coalesce(processed_at,now()),
      updated_at=now()
  where id=p_notification_id
  returning * into v_row;

  insert into public.registry_audit_log(
    actor_user_id, parish_id, diocese_id, entity_type, entity_id, action, after_data, metadata
  ) values (
    auth.uid(), v_row.receiver_parish_id, v_row.diocese_id,
    'official_notification', v_row.id, 'archive', to_jsonb(v_row),
    jsonb_build_object('decree_id',v_row.decree_id,'category',v_row.category)
  );

  return v_row;
end;
$function$
;

-- create_manual_marginal_note · V133
CREATE OR REPLACE FUNCTION public.create_manual_marginal_note(p_parish_id uuid, p_sacrament_type text, p_sacrament_id uuid, p_content text, p_note_date date DEFAULT CURRENT_DATE, p_print_policy text DEFAULT 'optional'::text, p_print_default boolean DEFAULT true, p_label text DEFAULT NULL::text, p_template_id uuid DEFAULT NULL::uuid, p_variables jsonb DEFAULT '{}'::jsonb, p_clause_snapshot jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_id uuid;
  v_diocese uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if p_parish_id is null or p_sacrament_id is null then raise exception 'Parroquia y partida son obligatorias'; end if;
  if nullif(trim(coalesce(p_content,'')),'') is null then raise exception 'El texto de la nota es obligatorio'; end if;
  if lower(coalesce(p_print_policy,'')) not in ('required','optional','internal') then raise exception 'Política de impresión inválida'; end if;

  v_role := public.current_app_role();
  v_diocese := public.current_app_diocese_id();
  if not public.can_access_parish(p_parish_id) then raise exception 'Fuera de jurisdicción'; end if;
  if v_role is null or v_role not in ('parish','chancery') then
    raise exception 'Sólo Parroquia propietaria y Cancillería de su diócesis pueden asentar notas manuales' using errcode='42501';
  end if;
  if v_role='parish' and p_parish_id is distinct from public.current_app_parish_id() then raise exception 'La parroquia sólo puede trabajar su propio archivo'; end if;
  if lower(p_print_policy)='required' and v_role='parish' then
    raise exception 'Las notas de impresión obligatoria requieren autoridad de Cancillería/Diócesis';
  end if;

  -- Asegurar que la partida existe y pertenece al ámbito declarado.
  if lower(p_sacrament_type) in ('bautismo','baptism') then
    if not exists(select 1 from public.baptisms where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Bautismo no encontrado'; end if;
  elsif lower(p_sacrament_type) in ('confirmacion','confirmation') then
    if not exists(select 1 from public.confirmations where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Confirmación no encontrada'; end if;
  elsif lower(p_sacrament_type) in ('matrimonio','marriage') then
    if not exists(select 1 from public.marriages where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Matrimonio no encontrado'; end if;
  elsif lower(p_sacrament_type) in ('exequias','funeral') then
    if not exists(select 1 from public.funerals where id=p_sacrament_id and parish_id=p_parish_id) then raise exception 'Exequias no encontradas'; end if;
  else
    raise exception 'Tipo de registro no admitido';
  end if;

  insert into public.marginal_notes(
    sacrament_type,note_type,content,parish_id,sacrament_id,note_date,source_type,source_id,
    created_by,status,template_id,template_version,print_policy,print_default,is_locked,print_label,
    rendered_variables,clause_snapshot
  )
  select
    lower(p_sacrament_type),'manual',trim(p_content),p_parish_id,p_sacrament_id,coalesce(p_note_date,current_date),
    'manual',null,auth.uid(),'active',p_template_id,t.version,lower(p_print_policy),p_print_default,false,p_label,
    coalesce(p_variables,'{}'::jsonb),coalesce(p_clause_snapshot,'[]'::jsonb)
  from (select 1) x
  left join public.marginal_note_templates t on t.id=p_template_id
  returning id into v_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),p_parish_id,v_diocese,'marginal_note',v_id,'manual_note_created',
         jsonb_build_object('sacrament_type',p_sacrament_type,'sacrament_id',p_sacrament_id,'print_policy',p_print_policy,'content',p_content),
         jsonb_build_object('template_id',p_template_id));

  return v_id;
end;
$function$
;

-- mark_official_notification_read · V133
CREATE OR REPLACE FUNCTION public.mark_official_notification_read(p_notification_id uuid)
 RETURNS official_notifications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.official_notifications%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_row
  from public.official_notifications
  where id = p_notification_id
  for update;

  if not found then raise exception 'Notificación no encontrada'; end if;

  if not (
    (public.current_app_role()='parish' and v_row.receiver_parish_id=public.current_app_parish_id())
  ) then
    raise exception 'No autorizado para esta notificación';
  end if;

  if lower(coalesce(v_row.status,'')) not in ('cancelled','archived') then
    update public.official_notifications
    set status='read', read_at=coalesce(read_at,now()), updated_at=now()
    where id=p_notification_id
    returning * into v_row;
  end if;

  return v_row;
end;
$function$
;
