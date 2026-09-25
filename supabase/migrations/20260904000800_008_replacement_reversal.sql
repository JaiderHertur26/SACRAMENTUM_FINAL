-- SACRAMENTUM - Fase 2.8
-- Reversión no destructiva de reposiciones de Bautismo.
-- Nunca elimina la partida ni retrocede/reutiliza consecutivos.

create or replace function public.reverse_replacement_decree(p_decree_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text; v_user_parish uuid; v_user_diocese uuid;
  v_decree public.decretos%rowtype;
  v_diocese uuid; v_replacement uuid; v_payload jsonb;
  v_book text; v_folio text; v_number text; v_match_count integer;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  select lower(coalesce(role,'')),parish_id,diocese_id into v_role,v_user_parish,v_user_diocese
  from public.user_profiles where auth_user_id=auth.uid() and coalesce(is_active,true)=true limit 1;

  select * into v_decree from public.decretos where id=p_decree_id for update;
  if not found then raise exception 'Decreto de reposición no encontrado'; end if;
  if lower(coalesce(v_decree.tipo,''))<>'reposicion' then raise exception 'El decreto no corresponde a una reposición'; end if;
  if lower(coalesce(v_decree.status,'active'))='reversed' then return true; end if;

  select diocese_id into v_diocese from public.parishes where id=v_decree.parish_id;
  if v_role in ('chancery','diocese') and v_user_diocese is distinct from v_diocese then raise exception 'La reposición está fuera de su jurisdicción'; end if;
  if v_role not in ('chancery','diocese','admin_general') then raise exception 'Sólo Cancillería, Diócesis o Administración General pueden revertir una reposición'; end if;

  v_payload:=coalesce(v_decree.payload,'{}'::jsonb);
  v_replacement:=v_decree.replacement_record_id;
  if v_replacement is null and coalesce(v_payload->>'newPartidaId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_replacement:=(v_payload->>'newPartidaId')::uuid;
  end if;

  -- Compatibilidad con reposiciones históricas que sólo guardaron L/F/N en JSON.
  if v_replacement is null then
    v_book:=coalesce(v_payload#>>'{newPartidaSummary,book}',v_payload#>>'{datosNuevaPartida,book}',v_payload#>>'{datosNuevaPartida,book_number}');
    v_folio:=coalesce(v_payload#>>'{newPartidaSummary,page}',v_payload#>>'{datosNuevaPartida,page}',v_payload#>>'{datosNuevaPartida,page_number}',v_payload#>>'{datosNuevaPartida,folio}');
    v_number:=coalesce(v_payload#>>'{newPartidaSummary,entry}',v_payload#>>'{datosNuevaPartida,entry}',v_payload#>>'{datosNuevaPartida,entry_number}',v_payload#>>'{datosNuevaPartida,numero}');
    if nullif(v_book,'') is not null and nullif(v_folio,'') is not null and nullif(v_number,'') is not null then
      select count(*),min(id) into v_match_count,v_replacement
      from public.baptisms
      where parish_id=v_decree.parish_id
        and ltrim(trim(coalesce(book_number,'')),'0')=ltrim(trim(v_book),'0')
        and ltrim(trim(coalesce(folio,'')),'0')=ltrim(trim(v_folio),'0')
        and ltrim(trim(coalesce(number,'')),'0')=ltrim(trim(v_number),'0');
      if v_match_count>1 then raise exception 'La reposición histórica coincide con varias partidas; requiere conciliación manual'; end if;
    end if;
  end if;

  if v_replacement is null then raise exception 'No se pudo identificar de forma segura la partida supletoria; no se realizará ninguna eliminación'; end if;

  update public.baptisms
  set status='reversed',
      raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('status','reversed','estado','revertida','replacementReversedByDecreeId',v_decree.id,'replacementReversedAt',now()),
      updated_at=now()
  where id=v_replacement and parish_id=v_decree.parish_id;
  if not found then raise exception 'La partida supletoria vinculada no existe en la parroquia'; end if;

  update public.marginal_notes set status='reversed',updated_at=now()
  where decree_id=v_decree.id or (source_type='decree' and source_id=v_decree.id);

  update public.official_notifications set status='cancelled',updated_at=now()
  where decree_id=v_decree.id and lower(coalesce(status,'pending')) not in ('cancelled');

  update public.decretos
  set status='reversed',updated_at=now(),replacement_record_id=coalesce(replacement_record_id,v_replacement),
      payload=v_payload||jsonb_build_object('status','reversed','reversedAt',now(),'reversedBy',auth.uid(),'newPartidaId',v_replacement)
  where id=v_decree.id;

  insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,before_data,after_data,metadata)
  values(auth.uid(),v_decree.parish_id,v_diocese,'decree',v_decree.id,'reverse_replacement',to_jsonb(v_decree),jsonb_build_object('status','reversed','replacement_record_id',v_replacement),jsonb_build_object('sequence_reused',false));

  return true;
end; $$;

revoke all on function public.reverse_replacement_decree(uuid) from public;
grant execute on function public.reverse_replacement_decree(uuid) to authenticated;
