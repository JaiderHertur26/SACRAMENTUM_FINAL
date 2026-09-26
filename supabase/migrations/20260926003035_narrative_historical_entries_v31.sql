-- SACRAMENTUM V31 · ASIENTOS HISTÓRICOS NARRATIVOS
-- Permite digitalizar partidas antiguas cuyo asiento físico es un solo cuerpo de texto.
-- No altera los RPC estructurados existentes.
-- Reglas narrativas: Libro + Folio + Número + Transcripción literal.
-- El texto literal se conserva en raw_data sin normalización editorial.

begin;

-- 1. Permitir fechas nulas EXCLUSIVAMENTE cuando el asiento es narrativo.
alter table public.confirmations alter column celebration_date drop not null;
alter table public.marriages alter column celebration_date drop not null;
alter table public.funerals alter column fecha_defuncion drop not null;

-- 2. Adaptar validaciones estructuradas de Bautismo y Confirmación.
alter table public.baptisms drop constraint if exists ck_baptisms_identity_complete;
alter table public.baptisms
  add constraint ck_baptisms_identity_complete
  check (
    lower(coalesce(raw_data->>'historicalEntryMode', raw_data->>'historical_entry_mode', 'structured')) = 'narrative'
    or (
      celebration_date is not null
      and nullif(trim(coalesce(nombres,'')), '') is not null
      and nullif(trim(coalesce(apellidos,'')), '') is not null
    )
  );

alter table public.confirmations drop constraint if exists ck_confirmations_identity_complete;
alter table public.confirmations
  add constraint ck_confirmations_identity_complete
  check (
    lower(coalesce(raw_data->>'historicalEntryMode', raw_data->>'historical_entry_mode', 'structured')) = 'narrative'
    or (
      celebration_date is not null
      and nullif(trim(coalesce(nombres,'')), '') is not null
      and nullif(trim(coalesce(apellidos,'')), '') is not null
    )
  );

-- 3. Mantener fecha obligatoria para todo registro NO narrativo.
alter table public.confirmations drop constraint if exists ck_confirmations_date_required_by_entry_mode;
alter table public.confirmations
  add constraint ck_confirmations_date_required_by_entry_mode
  check (
    lower(coalesce(raw_data->>'historicalEntryMode', raw_data->>'historical_entry_mode', 'structured')) = 'narrative'
    or celebration_date is not null
  );

alter table public.marriages drop constraint if exists ck_marriages_date_required_by_entry_mode;
alter table public.marriages
  add constraint ck_marriages_date_required_by_entry_mode
  check (
    lower(coalesce(raw_data->>'historicalEntryMode', raw_data->>'historical_entry_mode', 'structured')) = 'narrative'
    or celebration_date is not null
  );

alter table public.funerals drop constraint if exists ck_funerals_death_date_required_by_entry_mode;
alter table public.funerals
  add constraint ck_funerals_death_date_required_by_entry_mode
  check (
    lower(coalesce(raw_data->>'historicalEntryMode', raw_data->>'historical_entry_mode', 'structured')) = 'narrative'
    or fecha_defuncion is not null
  );

-- 4. Todo asiento marcado narrativo DEBE conservar una transcripción literal.
alter table public.baptisms drop constraint if exists ck_baptisms_narrative_transcription;
alter table public.baptisms
  add constraint ck_baptisms_narrative_transcription
  check (
    lower(coalesce(raw_data->>'historicalEntryMode', raw_data->>'historical_entry_mode', 'structured')) <> 'narrative'
    or nullif(btrim(coalesce(raw_data->>'literalTranscription', raw_data->>'literal_transcription', '')), '') is not null
  );

alter table public.confirmations drop constraint if exists ck_confirmations_narrative_transcription;
alter table public.confirmations
  add constraint ck_confirmations_narrative_transcription
  check (
    lower(coalesce(raw_data->>'historicalEntryMode', raw_data->>'historical_entry_mode', 'structured')) <> 'narrative'
    or nullif(btrim(coalesce(raw_data->>'literalTranscription', raw_data->>'literal_transcription', '')), '') is not null
  );

alter table public.marriages drop constraint if exists ck_marriages_narrative_transcription;
alter table public.marriages
  add constraint ck_marriages_narrative_transcription
  check (
    lower(coalesce(raw_data->>'historicalEntryMode', raw_data->>'historical_entry_mode', 'structured')) <> 'narrative'
    or nullif(btrim(coalesce(raw_data->>'literalTranscription', raw_data->>'literal_transcription', '')), '') is not null
  );

alter table public.funerals drop constraint if exists ck_funerals_narrative_transcription;
alter table public.funerals
  add constraint ck_funerals_narrative_transcription
  check (
    lower(coalesce(raw_data->>'historicalEntryMode', raw_data->>'historical_entry_mode', 'structured')) <> 'narrative'
    or nullif(btrim(coalesce(raw_data->>'literalTranscription', raw_data->>'literal_transcription', '')), '') is not null
  );

create or replace function public.register_historical_narrative(
  p_parish_id uuid,
  p_sacrament_type text,
  p_record jsonb
)
returns table(record_id uuid, book_number text, folio text, number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_user_parish uuid;
  v_diocese uuid;
  v_sacrament text;
  v_id uuid;
  v_book text;
  v_folio text;
  v_number text;
  v_book_type text;
  v_transcription text;
  v_payload jsonb;
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

  if v_role <> 'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede digitalizar un asiento narrativo de su libro físico';
  end if;

  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'Asiento histórico narrativo inválido';
  end if;

  v_sacrament := lower(trim(coalesce(p_sacrament_type,'')));
  v_sacrament := case
    when v_sacrament in ('bautismo','baptism') then 'bautismo'
    when v_sacrament in ('confirmacion','confirmación','confirmation') then 'confirmacion'
    when v_sacrament in ('matrimonio','marriage') then 'matrimonio'
    when v_sacrament in ('exequias','exequia','funeral','funerals') then 'exequias'
    else null
  end;

  if v_sacrament is null then
    raise exception 'Sacramento narrativo no soportado';
  end if;

  v_book := public.sacramentum_registry_ref(coalesce(
    p_record->>'Libro', p_record->>'libro', p_record->>'book_number'
  ));
  v_folio := public.sacramentum_registry_ref(coalesce(
    p_record->>'folio', p_record->>'page_number'
  ));
  v_number := public.sacramentum_registry_ref(coalesce(
    p_record->>'numero', p_record->>'number', p_record->>'entry_number'
  ));

  if v_book is null or v_folio is null or v_number is null then
    raise exception 'Libro, Folio y Número son obligatorios';
  end if;

  v_transcription := coalesce(
    p_record->>'literalTranscription',
    p_record->>'literal_transcription'
  );

  if nullif(btrim(coalesce(v_transcription,'')), '') is null then
    raise exception 'La Transcripción literal del asiento original es obligatoria';
  end if;

  v_book_type := lower(coalesce(
    nullif(trim(p_record->>'book_type'),''),
    nullif(trim(p_record->>'bookType'),''),
    'ordinario'
  ));

  if v_book_type not in ('ordinario','suplementario') then
    raise exception 'Tipo de libro histórico inválido';
  end if;

  -- Conserva literalmente literalTranscription; sólo normaliza metadatos de control.
  v_payload := p_record
    || jsonb_build_object(
      'historicalEntryMode','narrative',
      'source','historical_book_digitization',
      'status','seated',
      'Libro',v_book,
      'book_number',v_book,
      'folio',v_folio,
      'page_number',v_folio,
      'numero',v_number,
      'number',v_number,
      'entry_number',v_number,
      'book_type',v_book_type,
      'sacramentType',v_sacrament
    );

  if v_sacrament = 'bautismo' then
    if exists(
      select 1 from public.baptisms b
      where b.parish_id = p_parish_id
        and public.sacramentum_registry_ref(b.book_number) = v_book
        and public.sacramentum_registry_ref(b.folio) = v_folio
        and public.sacramentum_registry_ref(b.number) = v_number
    ) then
      raise exception 'Ya existe un Bautismo en Libro %, Folio %, Número %', v_book, v_folio, v_number;
    end if;

    insert into public.baptisms(
      parish_id, book_number, folio, number, status, raw_data
    ) values (
      p_parish_id, v_book, v_folio, v_number, 'seated', v_payload
    ) returning id into v_id;

  elsif v_sacrament = 'confirmacion' then
    if exists(
      select 1 from public.confirmations c
      where c.parish_id = p_parish_id
        and public.sacramentum_registry_ref(c.book_number) = v_book
        and public.sacramentum_registry_ref(c.folio) = v_folio
        and public.sacramentum_registry_ref(c.number) = v_number
    ) then
      raise exception 'Ya existe una Confirmación en Libro %, Folio %, Número %', v_book, v_folio, v_number;
    end if;

    insert into public.confirmations(
      parish_id, book_number, folio, number, status, celebration_date, raw_data
    ) values (
      p_parish_id, v_book, v_folio, v_number, 'seated', null, v_payload
    ) returning id into v_id;

  elsif v_sacrament = 'matrimonio' then
    if exists(
      select 1 from public.marriages m
      where m.parish_id = p_parish_id
        and m.book_type = v_book_type
        and public.sacramentum_registry_ref(m.book_number) = v_book
        and public.sacramentum_registry_ref(m.folio) = v_folio
        and public.sacramentum_registry_ref(m.number) = v_number
    ) then
      raise exception 'Ya existe un Matrimonio % en Libro %, Folio %, Número %', upper(v_book_type), v_book, v_folio, v_number;
    end if;

    insert into public.marriages(
      parish_id, celebration_date, book_number, folio, number, book_type, status, raw_data
    ) values (
      p_parish_id, null, v_book, v_folio, v_number, v_book_type, 'seated', v_payload
    ) returning id into v_id;

  elsif v_sacrament = 'exequias' then
    if exists(
      select 1 from public.funerals f
      where f.parish_id = p_parish_id
        and f.book_type = v_book_type
        and public.sacramentum_registry_ref(f.book_number) = v_book
        and public.sacramentum_registry_ref(f.folio) = v_folio
        and public.sacramentum_registry_ref(f.number) = v_number
    ) then
      raise exception 'Ya existe un registro de Exequias % en Libro %, Folio %, Número %', upper(v_book_type), v_book, v_folio, v_number;
    end if;

    insert into public.funerals(
      parish_id, book_number, folio, number, book_type, status, fecha_defuncion, raw_data
    ) values (
      p_parish_id, v_book, v_folio, v_number, v_book_type, 'seated', null, v_payload
    ) returning id into v_id;
  end if;

  insert into public.registry_audit_log(
    actor_user_id, parish_id, diocese_id, entity_type, entity_id,
    action, after_data, metadata
  )
  values(
    auth.uid(),
    p_parish_id,
    v_diocese,
    case v_sacrament
      when 'bautismo' then 'baptism'
      when 'confirmacion' then 'confirmation'
      when 'matrimonio' then 'marriage'
      else 'funeral'
    end,
    v_id,
    'historical_narrative_digitization',
    v_payload,
    jsonb_build_object(
      'book',v_book,
      'folio',v_folio,
      'number',v_number,
      'book_type',v_book_type,
      'historical_entry_mode','narrative',
      'changes_live_sequence',false
    )
  );

  return query select v_id, v_book, v_folio, v_number;
end;
$$;

revoke all on function public.register_historical_narrative(uuid,text,jsonb) from public, anon;
grant execute on function public.register_historical_narrative(uuid,text,jsonb) to authenticated;

comment on function public.register_historical_narrative(uuid,text,jsonb) is
  'V31: digitaliza un asiento físico narrativo de Bautismo, Confirmación, Matrimonio o Exequias conservando literalmente el texto original y sin consumir consecutivos vivos.';

commit;

notify pgrst, 'reload schema';
