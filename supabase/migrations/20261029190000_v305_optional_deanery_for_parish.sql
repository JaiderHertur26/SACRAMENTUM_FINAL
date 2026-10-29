-- V305: Parroquias operativas pueden depender directamente de una vicaria.
-- No se amplian roles, jurisdicciones ni permisos de creacion directa.
create or replace function public.enforce_parish_hierarchy()
returns trigger language plpgsql set search_path to 'public'
as $function$
declare
  v_vicaria_diocese uuid;
  v_decanato_diocese uuid;
  v_decanato_vicaria uuid;
  v_origin_ok boolean := false;
begin
  if new.diocese_id is null then
    raise exception 'La parroquia debe pertenecer a una Diócesis/Arquidiócesis';
  end if;

  if coalesce(new.is_operational,true)=false then
    if new.vicary_id is not null or new.decanate_id is not null then
      raise exception 'Un contenedor histórico legacy no puede pertenecer a la estructura territorial operativa';
    end if;
    return new;
  end if;

  if coalesce(new.legacy_territory_pending,false) then
    if new.legacy_origin_id is null then
      raise exception 'Una parroquia con territorio legacy pendiente debe conservar su origen verificado';
    end if;
    select exists(
      select 1
      from public.legacy_source_origins o
      join public.legacy_source_installations s on s.id=o.source_installation_id
      where o.id=new.legacy_origin_id
        and o.origin_kind in ('parish_snapshot','parish_snapshot_family')
        and o.identity_status in ('verified_unmapped','verified')
        and s.owner_diocese_id=new.diocese_id
    ) into v_origin_ok;
    if not v_origin_ok then
      raise exception 'El origen legacy no justifica una excepción territorial en esta jurisdicción';
    end if;
    if (new.vicary_id is null) <> (new.decanate_id is null) then
      raise exception 'Vicaría y Decanato deben permanecer ambos pendientes o ambos informados';
    end if;
  elsif new.vicary_id is null then
    raise exception 'Toda Parroquia operativa debe pertenecer a una Vicaría; el Decanato es opcional';
  end if;

  if new.decanate_id is not null then
    select diocese_id,vicaria_id
      into v_decanato_diocese,v_decanato_vicaria
    from public.decanatos
    where id=new.decanate_id;

    if v_decanato_diocese is null then
      raise exception 'El Decanato seleccionado no existe';
    end if;
    if v_decanato_diocese is distinct from new.diocese_id then
      raise exception 'La Parroquia y el Decanato deben pertenecer a la misma jurisdicción';
    end if;
    if new.vicary_id is null then
      new.vicary_id := v_decanato_vicaria;
    elsif new.vicary_id is distinct from v_decanato_vicaria then
      raise exception 'El Decanato seleccionado no pertenece a la Vicaría indicada';
    end if;
  end if;

  if new.vicary_id is not null then
    select diocese_id into v_vicaria_diocese
    from public.vicarias
    where id=new.vicary_id;
    if v_vicaria_diocese is null then
      raise exception 'La Vicaría seleccionada no existe';
    end if;
    if v_vicaria_diocese is distinct from new.diocese_id then
      raise exception 'La Parroquia y la Vicaría deben pertenecer a la misma jurisdicción';
    end if;
  end if;
  return new;
end;
$function$;

-- Los codigos parroquiales exigen vicaria, nunca decanato obligatorio.
-- Se mantienen la sesion autenticada, rol diocese, titularidad y jurisdiccion.
drop policy if exists "pending_tokens_insert_owner" on public.pending_tokens;
create policy "pending_tokens_insert_owner"
on public.pending_tokens for insert to authenticated
with check (
  (public.is_app_admin() and created_by=auth.uid() and upper(type)='DIOCESE')
  or
  (public.current_app_role()='diocese'
    and created_by=auth.uid()
    and upper(type) in ('PARISH','CHANCERY')
    and coalesce(payload->>'dioceseId','')=coalesce(public.current_effective_diocese_id()::text,'')
    and (upper(type)='CHANCERY' or coalesce(payload->>'vicaryId','')<>'')
  )
);
comment on policy "pending_tokens_insert_owner" on public.pending_tokens is
  'Admin: DIOCESE; Diócesis: CHANCERY/PARISH de su jurisdicción, Parroquia exige Vicaría; Decanato opcional.';
