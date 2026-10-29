-- V307: secure edit of pre-seat decree text, and sender-only chat withdrawal.
create or replace function public.edit_chancery_decree_document_v307(
 p_decree_id uuid,p_changes jsonb,p_reason text
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare a uuid:=auth.uid(); di uuid; ch uuid; d public.decretos%rowtype;
 patch jsonb:=coalesce(p_changes,'{}'::jsonb); next_payload jsonb;
 old_fields jsonb; justification text:=btrim(coalesce(p_reason,'')); value text;
begin
 if a is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 select up.diocese_id,up.chancery_id into di,ch from public.user_profiles up
 where up.auth_user_id=a and up.role='chancery' and up.is_active is true
 and upper(coalesce(up.status,''))='ACTIVE' limit 1;
 if di is null or ch is null then raise exception 'Solo Cancillería activa' using errcode='42501'; end if;
 if p_decree_id is null or jsonb_typeof(patch)<>'object' or patch='{}'::jsonb
 or exists(select 1 from jsonb_object_keys(patch) k
 where k not in ('reason','evidenceRef')) then
  raise exception 'Solo el fundamento y su referencia documental son editables'; end if;
 if length(justification) not between 12 and 500 then raise exception 'Motivo de la edición: 12 a 500 caracteres'; end if;
 select * into d from public.decretos
 where id=p_decree_id and diocese_id=di and chancery_id=ch for update;
 if not found then raise exception 'Decreto ajeno o inexistente' using errcode='42501'; end if;
 if d.status<>'active' or d.replacement_record_id is not null
 or d.payload->>'recordOrigin'<>'chancery_pending_seat_v280'
 or d.payload->>'seatStatus'<>'awaiting_parish'
 or coalesce(d.payload->>'historical','false')='true' then
  raise exception 'Decreto asentado/histórico: requiere rectificación formal'; end if;
 old_fields:=jsonb_build_object('reason',d.payload->>'reason','evidenceRef',d.payload->>'evidenceRef');
 next_payload:=d.payload;
 if patch ? 'reason' then
  value:=btrim(coalesce(patch->>'reason',''));
  if length(value) not between 12 and 4000 then raise exception 'Fundamento inválido'; end if;
  next_payload:=jsonb_set(next_payload,'{reason}',to_jsonb(value),true);
 end if;
 if patch ? 'evidenceRef' then
  value:=btrim(coalesce(patch->>'evidenceRef',''));
  if length(value) not between 3 and 400 then raise exception 'Referencia inválida'; end if;
  next_payload:=jsonb_set(next_payload,'{evidenceRef}',to_jsonb(value),true);
 end if;
 if next_payload=d.payload then return jsonb_build_object('updated',false,'decreeId',p_decree_id); end if;
 update public.decretos set payload=next_payload,updated_at=clock_timestamp() where id=p_decree_id;
 insert into public.registry_audit_log(actor_user_id,parish_id,diocese_id,entity_type,entity_id,
 action,before_data,after_data,metadata) values(a,d.parish_id,di,'decree',d.id,
 'edit_chancery_decree_document_v307',old_fields,
 jsonb_build_object('reason',next_payload->>'reason','evidenceRef',next_payload->>'evidenceRef'),
 jsonb_build_object('motivo',justification,'chancery_id',ch,'pre_seat_only',true));
 return jsonb_build_object('updated',true,'decreeId',p_decree_id);
end
$body$;
revoke all on function public.edit_chancery_decree_document_v307(uuid,jsonb,text) from PUBLIC,anon;
grant execute on function public.edit_chancery_decree_document_v307(uuid,jsonb,text) to authenticated;

create or replace function public.withdraw_chat_message(p_message_id uuid)
returns void language plpgsql security definer set search_path=''
as $body$
declare me uuid; room uuid;
begin
 if auth.uid() is null or p_message_id is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 me:=public.current_chat_profile_id();
 if me is null then raise exception 'Perfil de chat no autorizado' using errcode='42501'; end if;
 select room_id into room from public.chat_messages
 where id=p_message_id and sender_profile_id=me and deleted_at is null for update;
 if room is null then raise exception 'Solo puede eliminar sus propios mensajes' using errcode='42501'; end if;
 if not public.can_access_chat_room(room) then raise exception 'Conversación no autorizada' using errcode='42501'; end if;
 update public.chat_messages set deleted_at=clock_timestamp(),
   body='Mensaje retirado', metadata='{}'::jsonb
 where id=p_message_id and sender_profile_id=me and deleted_at is null;
end
$body$;
revoke all on function public.withdraw_chat_message(uuid) from PUBLIC,anon;
grant execute on function public.withdraw_chat_message(uuid) to authenticated;