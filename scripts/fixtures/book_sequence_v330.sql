-- Completa las relaciones del fixture V325 para el circuito integrado de decretos.
CREATE TABLE public.dioceses(id uuid PRIMARY KEY);
INSERT INTO public.dioceses SELECT DISTINCT diocese_id FROM public.parishes;
ALTER TABLE public.parishes ADD PRIMARY KEY(id);
ALTER TABLE public.parishes ADD COLUMN name text;
ALTER TABLE public.user_profiles ADD COLUMN chancery_id uuid, ADD COLUMN full_name text;
ALTER TABLE public.marriages ADD COLUMN numero_registro text;
ALTER TABLE public.funerals ADD COLUMN baptism_id uuid;
ALTER TABLE public.confirmations ALTER COLUMN hora_sacramento TYPE text USING hora_sacramento::text;
ALTER TABLE public.decretos ADD PRIMARY KEY(id), ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN parish_id uuid, ADD COLUMN diocese_id uuid, ADD COLUMN chancery_id uuid,
  ADD COLUMN tipo text, ADD COLUMN status text DEFAULT 'active',
  ADD COLUMN original_record_id uuid, ADD COLUMN replacement_record_id uuid,
  ADD COLUMN decree_date date, ADD COLUMN decree_number text, ADD COLUMN issued_by uuid;
DROP TABLE sacramentum_ledger.celebration_attestations_v263;
CREATE TABLE public.marginal_notes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sacrament_type text, note_type text, content text,
  parish_id uuid, sacrament_id uuid, note_date date, source_type text, source_id uuid, created_by uuid, status text
);
CREATE TABLE public.official_notifications(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),diocese_id uuid,sender_chancery_id uuid,receiver_parish_id uuid,
  decree_id uuid,category text,subject text,message text,status text DEFAULT 'pending',payload jsonb DEFAULT '{}',
  created_by uuid,created_at timestamptz DEFAULT now(),processed_at timestamptz
);
CREATE TABLE public.conceptos_anulacion(
  id uuid PRIMARY KEY,diocese_id uuid,tipo text,concepto text,codigo text,sacrament_type text,
  is_active boolean DEFAULT true,seinscribe boolean,enlibro integer,gendocum boolean,gennota boolean
);
CREATE TABLE public.chancelleries(id uuid PRIMARY KEY,diocese_id uuid,name text,chancellor_name text,vice_chancellor_name text);
CREATE TABLE public.pending_creation_requests(
  parish_id uuid,sacrament_type text,request_id uuid,payload_hash text,response jsonb,created_by uuid,
  PRIMARY KEY (parish_id,sacrament_type,request_id)
);
CREATE SCHEMA private;
CREATE FUNCTION private.normalize_decree_sacrament_scope_v83(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT lower(p) $$;
CREATE FUNCTION public.mark_official_notification_read(p_notification_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.official_notifications n SET status='read' WHERE n.id=p_notification_id
    AND EXISTS (SELECT 1 FROM public.user_profiles u WHERE u.auth_user_id=auth.uid() AND u.role='parish'
      AND u.parish_id=n.receiver_parish_id AND u.is_active AND upper(u.status)='ACTIVE');
$$;

-- Los ocho puntos de entrada previos a V287 sólo se declaran para ejecutar
-- su revocación real. El ensayo utiliza exclusivamente la emisión vigente.
DO $legacy$
DECLARE routine text;
BEGIN
  FOREACH routine IN ARRAY ARRAY[
    'apply_baptism_correction','apply_confirmation_correction',
    'apply_baptism_replacement','apply_confirmation_replacement',
    'apply_marriage_correction','create_marriage_reposition_by_decree',
    'apply_funeral_correction','create_funeral_reposition_by_decree'
  ] LOOP
    EXECUTE format('CREATE FUNCTION public.%I() RETURNS void LANGUAGE sql AS %L',routine,'SELECT NULL::void');
  END LOOP;
END;
$legacy$;
CREATE ROLE service_role;
-- Contrato histórico de Exequias previo a la validación de fechas V327.
create or replace function public.register_historical_funeral(
  p_parish_id uuid,
  p_record jsonb
)
returns table(
  record_id uuid,
  book_number text,
  folio text,
  number text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_user_parish uuid;
  v_diocese uuid;

  v_id uuid;
  v_book text;
  v_folio text;
  v_number text;
  v_book_type text;
  v_registry text;

  v_death date;
  v_birth date;
  v_funeral date;
  v_hour time;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada';
  end if;

  select lower(coalesce(role,'')), parish_id, diocese_id
    into v_role, v_user_parish, v_diocese
  from public.user_profiles
  where auth_user_id = auth.uid()
    and coalesce(is_active,true) = true
    and coalesce(status,'active') not in ('blocked','disabled','inactive')
  limit 1;

  if v_role <> 'parish'
     or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede digitalizar su libro de Exequias';
  end if;

  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'Registro de Exequias inválido';
  end if;

  v_book := public.sacramentum_registry_ref(
    coalesce(p_record->>'book_number',p_record->>'libro',p_record->>'Libro')
  );
  v_folio := public.sacramentum_registry_ref(
    coalesce(p_record->>'folio',p_record->>'page_number')
  );
  v_number := public.sacramentum_registry_ref(
    coalesce(p_record->>'number',p_record->>'numero',p_record->>'entry_number')
  );

  if v_book is null or v_folio is null or v_number is null then
    raise exception 'Libro, Folio y Número son obligatorios';
  end if;

  v_book_type := lower(coalesce(
    nullif(trim(p_record->>'book_type'),''),
    nullif(trim(p_record->>'bookType'),''),
    'ordinario'
  ));

  if v_book_type not in ('ordinario','suplementario') then
    raise exception 'Tipo de libro histórico inválido';
  end if;

  v_registry := nullif(trim(coalesce(
    p_record->>'numero_registro',
    p_record->>'numeroRegistro',
    ''
  )), '');

  begin
    v_death := nullif(p_record->>'fecha_defuncion','')::date;
  exception when others then
    raise exception 'Fecha de defunción inválida';
  end;

  begin
    v_birth := nullif(p_record->>'fecha_nacimiento','')::date;
  exception when others then
    raise exception 'Fecha de nacimiento inválida';
  end;

  begin
    v_funeral := nullif(p_record->>'fecha_exequias','')::date;
  exception when others then
    raise exception 'Fecha de Exequias inválida';
  end;

  begin
    v_hour := nullif(p_record->>'hora_exequias','')::time;
  exception when others then
    raise exception 'Hora de Exequias inválida';
  end;

  if v_death is null then
    raise exception 'La fecha de defunción es obligatoria';
  end if;

  if v_birth is not null and v_birth > v_death then
    raise exception 'La fecha de nacimiento no puede ser posterior a la fecha de defunción';
  end if;

  if v_funeral is not null and v_funeral < v_death then
    raise exception 'La fecha de Exequias no puede ser anterior a la fecha de defunción';
  end if;

  if exists(
    select 1
    from public.funerals f
    where f.parish_id = p_parish_id
      and f.book_type = v_book_type
      and public.sacramentum_registry_ref(f.book_number) = v_book
      and public.sacramentum_registry_ref(f.folio) = v_folio
      and public.sacramentum_registry_ref(f.number) = v_number
  ) then
    raise exception 'Ya existe un registro de Exequias % en Libro %, Folio %, Número %',
      upper(v_book_type), v_book, v_folio, v_number;
  end if;

  insert into public.funerals(
    parish_id,
    book_number,
    folio,
    number,
    numero_registro,
    book_type,
    status,
    nombres,
    apellidos,
    document_id,
    sexo,
    fecha_nacimiento,
    lugar_nacimiento,
    fecha_defuncion,
    lugar_defuncion,
    fecha_exequias,
    hora_exequias,
    lugar_exequias,
    cementerio,
    causa_muerte,
    nombre_padre,
    nombre_madre,
    conyuge,
    ministro,
    da_fe,
    observations,
    nota_marginal,
    raw_data
  )
  values(
    p_parish_id,
    v_book,
    v_folio,
    v_number,
    v_registry,
    v_book_type,
    'seated',
    nullif(p_record->>'nombres',''),
    nullif(p_record->>'apellidos',''),
    nullif(p_record->>'document_id',''),
    nullif(p_record->>'sexo',''),
    v_birth,
    nullif(p_record->>'lugar_nacimiento',''),
    v_death,
    nullif(p_record->>'lugar_defuncion',''),
    v_funeral,
    v_hour,
    nullif(p_record->>'lugar_exequias',''),
    nullif(p_record->>'cementerio',''),
    nullif(p_record->>'causa_muerte',''),
    nullif(p_record->>'nombre_padre',''),
    nullif(p_record->>'nombre_madre',''),
    nullif(p_record->>'conyuge',''),
    nullif(p_record->>'ministro',''),
    nullif(p_record->>'da_fe',''),
    nullif(p_record->>'observations',''),
    nullif(p_record->>'nota_marginal',''),
    p_record
      || jsonb_build_object(
        'book_number',v_book,
        'folio',v_folio,
        'number',v_number,
        'book_type',v_book_type,
        'status','seated',
        'source','historical_book_digitization'
      )
  )
  returning id into v_id;

  insert into public.registry_audit_log(
    actor_user_id,
    parish_id,
    diocese_id,
    entity_type,
    entity_id,
    action,
    after_data,
    metadata
  )
  values(
    auth.uid(),
    p_parish_id,
    v_diocese,
    'funeral',
    v_id,
    'historical_digitization',
    p_record,
    jsonb_build_object(
      'book',v_book,
      'folio',v_folio,
      'number',v_number,
      'book_type',v_book_type,
      'changes_live_sequence',false
    )
  );

  return query select v_id,v_book,v_folio,v_number;
end;
$function$;
