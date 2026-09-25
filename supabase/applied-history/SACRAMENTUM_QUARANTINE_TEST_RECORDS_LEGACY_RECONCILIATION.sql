-- SACRAMENTUM · cuarentena trazable de artefactos de prueba
-- No reutiliza consecutivos. No fuerza parroquia histórica sin mapeo.
begin;

create table if not exists public.sacramentum_test_record_archive (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  source_pk text not null,
  reason text not null,
  payload jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz not null default now()
);

alter table public.sacramentum_test_record_archive enable row level security;
revoke all on public.sacramentum_test_record_archive from anon,authenticated;
grant select,insert on public.sacramentum_test_record_archive to service_role;

insert into public.sacramentum_test_record_archive(entity_table,source_pk,reason,payload)
select 'baptisms',id::text,'DATOS DE PRUEBA SACRAMENTUM',to_jsonb(b)
from public.baptisms b where id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid
  and nombres='JUAN BAUTISMO' and apellidos='PRUEBA SACRAMENTUM';

insert into public.sacramentum_test_record_archive(entity_table,source_pk,reason,payload)
select 'confirmations',id::text,'DATOS DE PRUEBA SACRAMENTUM',to_jsonb(c)
from public.confirmations c where id='67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid
  and nombres='JUAN BAUTISMO' and apellidos='PRUEBA SACRAMENTUM';

insert into public.sacramentum_test_record_archive(entity_table,source_pk,reason,payload)
select 'pending_baptisms',id::text,'PENDIENTE DE PRUEBA SACRAMENTUM',to_jsonb(p)
from public.pending_baptisms p where id='f17a57ee-4904-4a57-94d3-0e089b3de2fa'::uuid;

insert into public.sacramentum_test_record_archive(entity_table,source_pk,reason,payload)
select 'pending_confirmations',id::text,'PENDIENTE DE PRUEBA SACRAMENTUM',to_jsonb(p)
from public.pending_confirmations p where id='571f5358-1a32-4a06-b438-64298c5156a2'::uuid;

insert into public.sacramentum_test_record_archive(entity_table,source_pk,reason,payload)
select 'marginal_notes',id::text,'NOTA CRUZADA GENERADA POR PRUEBA',to_jsonb(n)
from public.marginal_notes n
where source_id='67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid
   or sacrament_id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid;

insert into public.sacramentum_test_record_archive(entity_table,source_pk,reason,payload)
select 'registry_audit_log',id::text,'AUDITORÍA DE REGISTRO DE PRUEBA',to_jsonb(a)
from public.registry_audit_log a
where entity_id in (
 'c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid,
 '67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid
);

insert into public.sacramentum_test_record_archive(entity_table,source_pk,reason,payload)
select 'legacy_record_links',id::text,'ENLACE LEGACY INCORRECTO POR COLISIÓN L/F/N',to_jsonb(l)
from public.legacy_record_links l
where id='3943f426-f2da-4968-8560-a856f6044c40'::uuid;

do $$
begin
  if (select count(*) from public.baptisms where id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid and nombres='JUAN BAUTISMO' and apellidos='PRUEBA SACRAMENTUM') <> 1 then
    raise exception 'Cuarentena abortada: Bautismo de prueba no coincide exactamente';
  end if;
  if (select count(*) from public.confirmations where id='67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid and nombres='JUAN BAUTISMO' and apellidos='PRUEBA SACRAMENTUM') <> 1 then
    raise exception 'Cuarentena abortada: Confirmación de prueba no coincide exactamente';
  end if;
  if (select count(*) from public.legacy_import_rows where id='fc24f166-923e-4478-ac0b-ec1b4d313096'::uuid
      and normalized_data->>'names'='ANDRES EDUARDO'
      and normalized_data->>'last_names'='VELASQUEZ INSIGNARES'
      and normalized_data->>'celebration_date'='2000-10-21') <> 1 then
    raise exception 'Cuarentena abortada: fila histórica esperada no coincide';
  end if;
  if exists(select 1 from public.decretos where original_record_id in ('c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid,'67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid)
       or replacement_record_id in ('c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid,'67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid)) then
    raise exception 'Cuarentena abortada: existe decreto vinculado a datos de prueba';
  end if;
  if exists(select 1 from public.first_communions where baptism_id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid) then
    raise exception 'Cuarentena abortada: Bautismo de prueba tiene Primera Comunión vinculada';
  end if;
  if exists(select 1 from public.matrimonial_notifications where source_baptism_id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid or spouse_baptism_id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid) then
    raise exception 'Cuarentena abortada: Bautismo de prueba tiene notificación matrimonial vinculada';
  end if;
end $$;

update public.registry_audit_log
set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
  'test_record_archived',true,
  'archived_reason','DATOS DE PRUEBA SACRAMENTUM RETIRADOS DEL REGISTRO ACTIVO'
)
where entity_id in (
 'c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid,
 '67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid
);

delete from public.marginal_notes
where source_id='67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid
   or sacrament_id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid;

delete from public.legacy_record_links
where id='3943f426-f2da-4968-8560-a856f6044c40'::uuid;

delete from public.pending_confirmations
where id='571f5358-1a32-4a06-b438-64298c5156a2'::uuid;

delete from public.confirmations
where id='67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid;

delete from public.pending_baptisms
where id='f17a57ee-4904-4a57-94d3-0e089b3de2fa'::uuid;

delete from public.baptisms
where id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid;

update public.legacy_import_rows
set status='review',
    target_table=null,
    target_id=null,
    imported_at=null,
    issue_codes=(select array_agg(distinct x) from unnest(coalesce(issue_codes,'{}'::text[]) || array['LEGACY_LINK_COLLISION_REPAIRED','PARISH_MAPPING_REQUIRED']) x),
    issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object(
      'legacy_link_collision_repaired',true,
      'previous_wrong_target_id','67ca9e4f-5cfe-406b-be70-61c574f9f8ef',
      'required_source_parish','PARROQUIA SANTA TERESITA DEL NIÑO JESUS',
      'mapping_status','unmapped',
      'action_required','Mapear parroquia histórica antes de crear/vincular la partida activa'
    ),
    updated_at=now()
where id='fc24f166-923e-4478-ac0b-ec1b4d313096'::uuid;

update public.legacy_import_batches b
set imported_count=(select count(*) from public.legacy_import_rows where batch_id=b.id and status='imported'),
    valid_count=(select count(*) from public.legacy_import_rows where batch_id=b.id and status='valid'),
    review_count=(select count(*) from public.legacy_import_rows where batch_id=b.id and status='review'),
    skipped_count=(select count(*) from public.legacy_import_rows where batch_id=b.id and status in ('skipped','duplicate')),
    error_count=(select count(*) from public.legacy_import_rows where batch_id=b.id and status='error'),
    status='completed_with_review',updated_at=now()
where id='6cbbe570-6b2a-42b2-8be8-54a742e8f07e'::uuid;

commit;

select jsonb_build_object(
  'test_baptism_active', (select count(*) from public.baptisms where id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid),
  'test_confirmation_active', (select count(*) from public.confirmations where id='67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid),
  'test_pending_baptism_active', (select count(*) from public.pending_baptisms where id='f17a57ee-4904-4a57-94d3-0e089b3de2fa'::uuid),
  'test_pending_confirmation_active', (select count(*) from public.pending_confirmations where id='571f5358-1a32-4a06-b438-64298c5156a2'::uuid),
  'test_cross_notes_active', (select count(*) from public.marginal_notes where source_id='67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid or sacrament_id='c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid),
  'archive_rows', (select count(*) from public.sacramentum_test_record_archive),
  'andres_row_status', (select status from public.legacy_import_rows where id='fc24f166-923e-4478-ac0b-ec1b4d313096'::uuid),
  'andres_target_id', (select target_id from public.legacy_import_rows where id='fc24f166-923e-4478-ac0b-ec1b4d313096'::uuid),
  'confirm_batch', (select jsonb_build_object('status',status,'imported',imported_count,'review',review_count) from public.legacy_import_batches where id='6cbbe570-6b2a-42b2-8be8-54a742e8f07e'::uuid)
) as quarantine_postcheck;
