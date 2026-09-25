-- SACRAMENTUM · Reparación de colisión legacy/prueba ya depurada parcialmente.
-- Restaura CONFIRMA 0001/0001/0001 desde staging y conserva trazabilidad.

begin;

create table if not exists public.registry_test_artifact_archive (
  id uuid primary key default gen_random_uuid(),
  artifact_type text not null,
  source_table text not null,
  source_id uuid,
  reason text not null,
  snapshot jsonb not null,
  archived_at timestamptz not null default now(),
  unique(source_table,source_id,artifact_type)
);

alter table public.registry_test_artifact_archive enable row level security;
revoke all on public.registry_test_artifact_archive from anon,authenticated;
grant select,insert on public.registry_test_artifact_archive to service_role;

insert into public.registry_test_artifact_archive(artifact_type,source_table,source_id,reason,snapshot)
select 'test_audit','registry_audit_log',a.id,'Auditoría original de artefacto PRUEBA SACRAMENTUM',to_jsonb(a)
from public.registry_audit_log a
where a.entity_id in ('c4570f19-b42c-425c-aaf8-5ca51f4ab58e'::uuid,'67ca9e4f-5cfe-406b-be70-61c574f9f8ef'::uuid)
on conflict(source_table,source_id,artifact_type) do nothing;
do $$
declare
  v_row public.legacy_import_rows%rowtype;
  v_batch public.legacy_import_batches%rowtype;
  d jsonb;
  v_date date;
  v_birth date;
  v_new_confirmation uuid;
begin
  if exists(select 1 from public.confirmations where book_number='0001' and folio='0001' and number='0001') then
    raise exception 'L/F/N 0001/0001/0001 volvió a quedar ocupado';
  end if;

  select * into v_row
  from public.legacy_import_rows
  where id='fc24f166-923e-4478-ac0b-ec1b4d313096'::uuid
  for update;
  if not found then raise exception 'Fila legacy de Andrés Eduardo no encontrada'; end if;

  select * into v_batch from public.legacy_import_batches where id=v_row.batch_id;
  if not found then raise exception 'Lote CONFIRMA no encontrado'; end if;
  d := v_row.normalized_data;
  if upper(coalesce(d->>'names','')) <> 'ANDRES EDUARDO'
     or upper(coalesce(d->>'last_names','')) <> 'VELASQUEZ INSIGNARES'
     or coalesce(d->>'celebration_date','') <> '2000-10-21' then
    raise exception 'La fila staging no coincide con Andrés Eduardo esperado';
  end if;
  v_date := nullif(d->>'celebration_date','')::date;
  v_birth := nullif(d->>'birth_date','')::date;

  insert into public.confirmations(
    parish_id,book_number,folio,number,status,celebration_date,fecha_nacimiento,
    lugar_bautismo,apellidos,nombres,sexo,nombre_padre,nombre_madre,padrinos,
    ministro,da_fe,observations,raw_data
  ) values (
    v_batch.parish_id,
    public.sacramentum_registry_ref(d->>'book_number'),
    public.sacramentum_registry_ref(d->>'folio'),
    public.sacramentum_registry_ref(d->>'number'),
    case when coalesce((d->>'annulled')::boolean,false) then 'anulada' else 'seated' end,
    v_date,v_birth,nullif(d->>'baptism_place',''),nullif(d->>'last_names',''),nullif(d->>'names',''),
    nullif(d->>'gender',''),nullif(d->>'father_name',''),nullif(d->>'mother_name',''),nullif(d->>'sponsor',''),
    nullif(d->>'minister',''),nullif(d->>'legacy_dafe_code',''),nullif(d->>'observations',''),
    coalesce(v_row.original_data,'{}'::jsonb)||jsonb_build_object(
      'legacy_normalized',d,'source','legacy_import',
      'source_parish_name','PARROQUIA SANTA TERESITA DEL NIÑO JESUS',
      'legacy_mapping_status','unmapped')
  ) returning id into v_new_confirmation;

  update public.legacy_import_rows
     set status='imported',target_table='confirmation',target_id=v_new_confirmation,
         issue_codes=array_remove(coalesce(issue_codes,'{}'::text[]),'IMPORT_ERROR'),
         issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object('repair','restored after test collision'),
         imported_at=now(),updated_at=now()
   where id=v_row.id;
  insert into public.legacy_record_links(source_system,profile_key,source_key,checksum,batch_id,row_id,target_table,target_id,metadata)
  values(v_batch.source_system,'CONFIRMA','0001|0001|0001',v_row.checksum,v_row.batch_id,v_row.id,'confirmation',v_new_confirmation,
         jsonb_build_object('filename',v_batch.original_filename,'repair','test_collision_repaired'))
  on conflict(source_system,profile_key,source_key)
  do update set checksum=excluded.checksum,batch_id=excluded.batch_id,row_id=excluded.row_id,
                target_table=excluded.target_table,target_id=excluded.target_id,metadata=excluded.metadata,updated_at=now();

  update public.confirmations c
     set raw_data=coalesce(c.raw_data,'{}'::jsonb)||jsonb_build_object(
       'source_parish_name','PARROQUIA SANTA TERESITA DEL NIÑO JESUS',
       'legacy_mapping_status','unmapped')
   where c.raw_data->>'source'='legacy_import'
     and coalesce(c.raw_data->>'lugcon',c.raw_data#>>'{legacy_normalized,celebration_place}')='PARROQUIA SANTA TERESITA DEL NIÑO JESUS';

  insert into public.registry_audit_log(parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
  values(v_batch.parish_id,v_batch.diocese_id,'confirmation',v_new_confirmation,'legacy_test_collision_repaired',
         jsonb_build_object('source_key','0001|0001|0001','names',d->>'names','last_names',d->>'last_names'),
         jsonb_build_object('live_sequences_changed',false,'source_parish_mapping','unmapped'));
end $$;
do $$
declare v_total int; v_legacy int;
begin
  select count(*) into v_total from public.confirmations where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid;
  select count(*) into v_legacy from public.confirmations where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid and raw_data->>'source'='legacy_import';
  if v_total<>173 or v_legacy<>173 then raise exception 'Confirmación esperada 173/173 legacy, actual %/%',v_total,v_legacy; end if;
  if exists(select 1 from public.confirmations where upper(coalesce(apellidos,''))='PRUEBA SACRAMENTUM') then raise exception 'Persiste Confirmación de prueba'; end if;
  if not exists(select 1 from public.confirmations where book_number='0001' and folio='0001' and number='0001' and upper(nombres)='ANDRES EDUARDO' and upper(apellidos)='VELASQUEZ INSIGNARES') then
    raise exception 'No quedó restaurada la Confirmación histórica 0001/0001/0001';
  end if;
end $$;

commit;

select jsonb_build_object(
 'confirmations_total',(select count(*) from public.confirmations where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid),
 'confirmations_legacy',(select count(*) from public.confirmations where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid and raw_data->>'source'='legacy_import'),
 'baptisms_total',(select count(*) from public.baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687'::uuid),
 'archived_test_audits',(select count(*) from public.registry_test_artifact_archive where artifact_type='test_audit'),
 'restored',(select jsonb_build_object('id',id,'book',book_number,'folio',folio,'number',number,'nombres',nombres,'apellidos',apellidos,'source_parish',raw_data->>'source_parish_name','mapping',raw_data->>'legacy_mapping_status') from public.confirmations where book_number='0001' and folio='0001' and number='0001')
) as repair_postcheck;