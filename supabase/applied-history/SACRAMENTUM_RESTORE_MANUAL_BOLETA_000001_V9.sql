begin;

do $$
declare
  v_pending_audit public.registry_audit_log%rowtype;
  v_seat_audit public.registry_audit_log%rowtype;
  v_p jsonb;
  v_s jsonb;
begin
  select * into v_pending_audit
  from public.registry_audit_log
  where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
    and action='create_pending'
    and entity_type='pending_baptism'
    and entity_id='f17a57ee-4904-4a57-94d3-0e089b3de2fa'
  order by created_at desc limit 1;

  select * into v_seat_audit
  from public.registry_audit_log
  where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
    and action='seat'
    and entity_type='baptism'
    and entity_id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'
    and metadata->>'pending_id'='f17a57ee-4904-4a57-94d3-0e089b3de2fa'
  order by created_at desc limit 1;

  if v_pending_audit.id is null or v_seat_audit.id is null then
    raise exception 'No existe evidencia auditada suficiente para restaurar la boleta #000001';
  end if;

  if exists(select 1 from public.pending_baptisms where id='f17a57ee-4904-4a57-94d3-0e089b3de2fa')
     or exists(select 1 from public.baptisms where id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e') then
    raise exception 'La boleta o partida #000001 ya existe';
  end if;

  if exists(select 1 from public.baptisms
    where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'
      and book_number='0001' and folio='0001' and number='0001') then
    raise exception 'L/F/N 0001/0001/0001 ya está ocupado';
  end if;

  v_p := coalesce(v_pending_audit.after_data,'{}'::jsonb);
  v_s := coalesce(v_seat_audit.after_data,'{}'::jsonb);

  insert into public.baptisms(
    id,parish_id,book_number,folio,number,numero_registro,status,
    celebration_date,lugar_bautismo,apellidos,nombres,sexo,
    fecha_nacimiento,lugar_nacimiento,nombre_padre,cedula_padre,
    nombre_madre,cedula_madre,tipo_union_padres,padrinos,
    abuelos_paternos,abuelos_maternos,ministro,da_fe,nuip,
    serial_registro,oficina_registro,fecha_expedicion_registro,
    direccion,hora_sacramento,nota_marginal,observations,raw_data,created_at
  ) values (
    'c4570f19-b42c-425c-aaf8-5ca51f4ab58e',
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',
    '0001','0001','0001',
    nullif(coalesce(v_s->>'numeroRegistro',v_s->>'numero_registro'),''),
    'seated',
    nullif(v_s->>'fechaSacramento','')::date,
    nullif(v_s->>'lugarBautismo',''),
    nullif(v_s->>'apellidos',''),
    nullif(v_s->>'nombres',''),
    nullif(v_s->>'sexo',''),
    nullif(v_s->>'fechaNacimiento','')::date,
    nullif(v_s->>'lugarNacimiento',''),
    nullif(v_s->>'nombrePadre',''),
    nullif(v_s->>'cedulaPadre',''),
    nullif(v_s->>'nombreMadre',''),
    nullif(v_s->>'cedulaMadre',''),
    nullif(v_s->>'tipoUnionPadres',''),
    nullif(v_s->>'padrinos',''),
    nullif(v_s->>'abuelosPaternos',''),
    nullif(v_s->>'abuelosMaternos',''),
    nullif(v_s->>'ministro',''),
    nullif(coalesce(v_s->>'daFe',v_s->>'da_fe'),''),
    nullif(v_s->>'nuip',''),
    nullif(v_s->>'serialRegistro',''),
    nullif(v_s->>'oficinaRegistro',''),
    nullif(v_s->>'fechaExpedicionRegistro','')::date,
    nullif(v_s->>'direccion',''),
    nullif(v_s->>'horaSacramento',''),
    nullif(v_s->>'notaMarginal',''),
    nullif(coalesce(v_s->>'observations',v_s->>'observaciones',v_s->>'obs'),''),
    v_s || jsonb_build_object(
      'source','current_parish_registration',
      'pending_id','f17a57ee-4904-4a57-94d3-0e089b3de2fa',
      'restored_from_audit',true
    ),
    v_seat_audit.created_at
  );

  insert into public.pending_baptisms(
    id,parish_id,status,reportado,raw_data,created_at
  ) values (
    'f17a57ee-4904-4a57-94d3-0e089b3de2fa',
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',
    'seated',
    true,
    v_s || jsonb_build_object(
      'id','f17a57ee-4904-4a57-94d3-0e089b3de2fa',
      'parishId','ada2c810-c6eb-4b75-8e3c-4941e3022687',
      'parish_id','ada2c810-c6eb-4b75-8e3c-4941e3022687',
      'reportado',true,
      'source','current_parish_registration',
      'seated_baptism_id','c4570f19-b42c-425c-aaf8-5ca51f4ab58e',
      'seated_book','0001',
      'seated_folio','0001',
      'seated_number','0001',
      'boleta_archived',true,
      'restored_from_audit',true
    ),
    v_pending_audit.created_at
  );

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    v_seat_audit.actor_user_id,
    'ada2c810-c6eb-4b75-8e3c-4941e3022687',
    v_seat_audit.diocese_id,
    'pending_baptism',
    'f17a57ee-4904-4a57-94d3-0e089b3de2fa',
    'restore_seated_boleta',
    v_s,
    jsonb_build_object(
      'numero_registro','000001',
      'baptism_id','c4570f19-b42c-425c-aaf8-5ca51f4ab58e',
      'book','0001','folio','0001','number','0001',
      'reason','Restaurada desde auditoría por confirmación del usuario como boleta manual válida'
    )
  );
end;
$$;

commit;
