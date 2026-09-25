-- ==========================================================================
-- SACRAMENTUM · Fase 2.13 · Digitalización histórica del libro de Exequias
-- Registra un asiento físico existente sin mover el consecutivo vivo.
-- ==========================================================================
create or replace function public.register_historical_funeral(
  p_parish_id uuid,
  p_record jsonb
)
returns table(record_id uuid, book_number text, folio text, number text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_user_parish uuid; v_diocese uuid;
  v_id uuid; v_book text; v_folio text; v_number text;
  v_death date; v_birth date; v_funeral date; v_hour time;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(role,'')),parish_id,diocese_id into v_role,v_user_parish,v_diocese
  from public.user_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)=true
    and coalesce(status,'active') not in ('blocked','disabled','inactive') limit 1;
  if v_role<>'parish' or v_user_parish is distinct from p_parish_id then
    raise exception 'Sólo la parroquia propietaria puede digitalizar su libro de Exequias';
  end if;
  if p_record is null or jsonb_typeof(p_record)<>'object' then raise exception 'Registro de Exequias inválido'; end if;

  v_book:=public.sacramentum_registry_ref(coalesce(p_record->>'book_number',p_record->>'libro',p_record->>'Libro'));
  v_folio:=public.sacramentum_registry_ref(coalesce(p_record->>'folio',p_record->>'page_number'));
  v_number:=public.sacramentum_registry_ref(coalesce(p_record->>'number',p_record->>'numero',p_record->>'entry_number'));
  if v_book is null or v_folio is null or v_number is null then raise exception 'Libro, Folio y Número son obligatorios'; end if;

  begin v_death:=nullif(p_record->>'fecha_defuncion','')::date; exception when others then raise exception 'Fecha de defunción inválida'; end;
  begin v_birth:=nullif(p_record->>'fecha_nacimiento','')::date; exception when others then raise exception 'Fecha de nacimiento inválida'; end;
  begin v_funeral:=nullif(p_record->>'fecha_exequias','')::date; exception when others then raise exception 'Fecha de exequias inválida'; end;
  begin v_hour:=nullif(p_record->>'hora_exequias','')::time; exception when others then raise exception 'Hora de exequias inválida'; end;
  if v_death is null then raise exception 'La fecha de defunción es obligatoria'; end if;

  if exists(select 1 from public.funerals f where f.parish_id=p_parish_id and public.sacramentum_registry_ref(f.book_number)=v_book and public.sacramentum_registry_ref(f.folio)=v_folio and public.sacramentum_registry_ref(f.number)=v_number) then
    raise exception 'Ya existe un registro de Exequias en Libro %, Folio %, Número %',v_book,v_folio,v_number;
  end if;

  insert into public.funerals(
    parish_id,book_number,folio,number,status,nombres,apellidos,document_id,sexo,
    fecha_nacimiento,lugar_nacimiento,fecha_defuncion,lugar_defuncion,fecha_exequias,hora_exequias,
    lugar_exequias,cementerio,causa_muerte,nombre_padre,nombre_madre,conyuge,ministro,da_fe,
    observations,nota_marginal,raw_data
  ) values (
    p_parish_id,v_book,v_folio,v_number,'seated',nullif(p_record->>'nombres',''),nullif(p_record->>'apellidos',''),
    nullif(p_record->>'document_id',''),nullif(p_record->>'sexo',''),v_birth,nullif(p_record->>'lugar_nacimiento',''),
    v_death,nullif(p_record->>'lugar_defuncion',''),v_funeral,v_hour,nullif(p_record->>'lugar_exequias',''),
    nullif(p_record->>'cementerio',''),nullif(p_record->>'causa_muerte',''),nullif(p_record->>'nombre_padre',''),
    nullif(p_record->>'nombre_madre',''),nullif(p_record->>'conyuge',''),nullif(p_record->>'ministro',''),
    nullif(p_record->>'da_fe',''),nullif(p_record->>'observations',''),nullif(p_record->>'nota_marginal',''),
    p_record||jsonb_build_object('book_number',v_book,'folio',v_folio,'number',v_number,'status','seated','source','historical_book_digitization')
  ) returning id into v_id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(auth.uid(),p_parish_id,v_diocese,'funeral',v_id,'historical_digitization',p_record,
         jsonb_build_object('book',v_book,'folio',v_folio,'number',v_number,'changes_live_sequence',false));

  return query select v_id,v_book,v_folio,v_number;
end;
$$;
revoke all on function public.register_historical_funeral(uuid,jsonb) from public;
grant execute on function public.register_historical_funeral(uuid,jsonb) to authenticated;
comment on function public.register_historical_funeral(uuid,jsonb) is 'Digitaliza un asiento físico de Exequias sin modificar el consecutivo ordinario vivo.';
