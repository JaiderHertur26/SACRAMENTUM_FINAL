-- SACRAMENTUM V71
-- Auditoría canónica de impresiones: cada evento conserva una fotografía
-- de Libro/Folio/Número además del UUID del registro y del usuario/fecha.

create or replace function public.register_registry_print(
  p_parish_id uuid,
  p_sacrament_type text,
  p_sacrament_id uuid,
  p_document_kind text default 'partida',
  p_selected_note_keys text[] default '{}'::text[],
  p_included_notes jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
  v_type text:=lower(trim(coalesce(p_sacrament_type,'')));
  v_book text;
  v_folio text;
  v_number text;
  v_metadata jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  if not public.can_access_parish(p_parish_id) then raise exception 'Fuera de jurisdicción'; end if;
  if p_sacrament_id is null then raise exception 'Registro requerido'; end if;

  if v_type in ('bautismo','baptism','bautizo') then
    v_type:='bautismo';
    select book_number,folio,number
      into v_book,v_folio,v_number
    from public.baptisms
    where id=p_sacrament_id and parish_id=p_parish_id;
    if not found then raise exception 'Bautismo no encontrado'; end if;

  elsif v_type in ('confirmacion','confirmación','confirmation') then
    v_type:='confirmacion';
    select book_number,folio,number
      into v_book,v_folio,v_number
    from public.confirmations
    where id=p_sacrament_id and parish_id=p_parish_id;
    if not found then raise exception 'Confirmación no encontrada'; end if;

  elsif v_type in ('matrimonio','marriage') then
    v_type:='matrimonio';
    select book_number,folio,number
      into v_book,v_folio,v_number
    from public.marriages
    where id=p_sacrament_id and parish_id=p_parish_id;
    if not found then raise exception 'Matrimonio no encontrado'; end if;

  elsif v_type in ('exequias','exequia','funeral','funerals') then
    v_type:='exequias';
    select book_number,folio,number
      into v_book,v_folio,v_number
    from public.funerals
    where id=p_sacrament_id and parish_id=p_parish_id;
    if not found then raise exception 'Exequias no encontradas'; end if;

  else
    raise exception 'Tipo de registro no admitido';
  end if;

  v_metadata:=coalesce(p_metadata,'{}'::jsonb)
    || jsonb_build_object(
      'book',coalesce(v_book,''),
      'folio',coalesce(v_folio,''),
      'number',coalesce(v_number,''),
      'coordinates_source','record_snapshot'
    );

  insert into public.registry_print_events(
    parish_id,sacrament_type,sacrament_id,document_kind,
    selected_note_keys,included_notes,requested_by,metadata
  )
  values(
    p_parish_id,v_type,p_sacrament_id,
    coalesce(nullif(trim(p_document_kind),''),'partida'),
    coalesce(p_selected_note_keys,'{}'::text[]),
    coalesce(p_included_notes,'[]'::jsonb),
    auth.uid(),
    v_metadata
  )
  returning id into v_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  )
  values(
    auth.uid(),p_parish_id,public.current_app_diocese_id(),
    'registry_print_event',v_id,'print_requested',
    jsonb_build_object(
      'sacrament_type',v_type,
      'sacrament_id',p_sacrament_id,
      'document_kind',coalesce(nullif(trim(p_document_kind),''),'partida'),
      'book',coalesce(v_book,''),
      'folio',coalesce(v_folio,''),
      'number',coalesce(v_number,'')
    ),
    jsonb_build_object(
      'selected_note_keys',coalesce(p_selected_note_keys,'{}'::text[])
    ) || v_metadata
  );

  return v_id;
end;
$$;

revoke all on function public.register_registry_print(uuid,text,uuid,text,text[],jsonb,jsonb) from public;
revoke all on function public.register_registry_print(uuid,text,uuid,text,text[],jsonb,jsonb) from anon;
grant execute on function public.register_registry_print(uuid,text,uuid,text,text[],jsonb,jsonb) to authenticated;

comment on function public.register_registry_print(uuid,text,uuid,text,text[],jsonb,jsonb)
is 'Registra una impresión institucional y conserva una fotografía de Libro/Folio/Número, usuario, fecha, tipo documental y notas incluidas.';

-- Backfill determinístico de eventos existentes por UUID exacto del sacramento.
update public.registry_print_events e
set metadata=coalesce(e.metadata,'{}'::jsonb)
  || jsonb_build_object(
    'book',coalesce(b.book_number,''),
    'folio',coalesce(b.folio,''),
    'number',coalesce(b.number,''),
    'coordinates_source','record_uuid_backfill',
    'coordinates_backfilled_at',now()
  )
from public.baptisms b
where e.sacrament_type in ('bautismo','baptism','bautizo')
  and e.sacrament_id=b.id
  and e.parish_id=b.parish_id
  and (
    nullif(e.metadata->>'book','') is null
    or nullif(e.metadata->>'folio','') is null
    or nullif(e.metadata->>'number','') is null
  );

update public.registry_print_events e
set metadata=coalesce(e.metadata,'{}'::jsonb)
  || jsonb_build_object(
    'book',coalesce(c.book_number,''),
    'folio',coalesce(c.folio,''),
    'number',coalesce(c.number,''),
    'coordinates_source','record_uuid_backfill',
    'coordinates_backfilled_at',now()
  )
from public.confirmations c
where e.sacrament_type in ('confirmacion','confirmación','confirmation')
  and e.sacrament_id=c.id
  and e.parish_id=c.parish_id
  and (
    nullif(e.metadata->>'book','') is null
    or nullif(e.metadata->>'folio','') is null
    or nullif(e.metadata->>'number','') is null
  );

update public.registry_print_events e
set metadata=coalesce(e.metadata,'{}'::jsonb)
  || jsonb_build_object(
    'book',coalesce(m.book_number,''),
    'folio',coalesce(m.folio,''),
    'number',coalesce(m.number,''),
    'coordinates_source','record_uuid_backfill',
    'coordinates_backfilled_at',now()
  )
from public.marriages m
where e.sacrament_type in ('matrimonio','marriage')
  and e.sacrament_id=m.id
  and e.parish_id=m.parish_id
  and (
    nullif(e.metadata->>'book','') is null
    or nullif(e.metadata->>'folio','') is null
    or nullif(e.metadata->>'number','') is null
  );

update public.registry_print_events e
set metadata=coalesce(e.metadata,'{}'::jsonb)
  || jsonb_build_object(
    'book',coalesce(f.book_number,''),
    'folio',coalesce(f.folio,''),
    'number',coalesce(f.number,''),
    'coordinates_source','record_uuid_backfill',
    'coordinates_backfilled_at',now()
  )
from public.funerals f
where e.sacrament_type in ('exequias','exequia','funeral','funerals')
  and e.sacrament_id=f.id
  and e.parish_id=f.parish_id
  and (
    nullif(e.metadata->>'book','') is null
    or nullif(e.metadata->>'folio','') is null
    or nullif(e.metadata->>'number','') is null
  );
