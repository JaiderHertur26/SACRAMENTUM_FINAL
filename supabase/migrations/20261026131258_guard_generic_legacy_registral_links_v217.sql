-- V217: Guard every registral legacy link at its common BEFORE INSERT/UPDATE boundary.
-- Existing rows are not rewritten. Global catalog links remain outside this scope.
DO $migration$
DECLARE
 v_ddl text;
 v_old text := $old$begin
  select normalized_data into d
  from public.legacy_import_rows
  where id=new.row_id;$old$;
 v_new text := $new$begin
  -- The original name-and-date check remains below. This additional contract
  -- checks institution, provenance and physical record BEFORE any UPSERT.
  if new.target_table in (
     'baptism','baptisms','confirmation','confirmations',
     'marriage','marriages','funeral','funerals',
     'pending_baptisms','pending_confirmations','pending_marriages','pending_funerals',
     'marginal_notes','legacy_marginal_note_queue'
  ) or (tg_op='UPDATE' and old.target_table in (
     'baptism','baptisms','confirmation','confirmations',
     'marriage','marriages','funeral','funerals',
     'pending_baptisms','pending_confirmations','pending_marriages','pending_funerals',
     'marginal_notes','legacy_marginal_note_queue'
  )) then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.source_system || ':' || new.profile_key || ':' || new.source_key, 0)
    );
    if not exists(
      select 1 from public.legacy_import_batches b
      join public.legacy_import_rows r on r.batch_id=b.id
      where b.id=new.batch_id and r.id=new.row_id
        and b.parish_id is not null and b.parish_id = (
          select p.id from public.parishes p where p.id=b.parish_id
        )
        and b.source_system=new.source_system and b.profile_key=new.profile_key
        and coalesce(r.source_key,r.row_number::text)=new.source_key
    ) then
      raise exception 'V217 enlace registral sin lote, fila o parroquia de procedencia válida';
    end if;
    if tg_op='UPDATE' and (
       old.source_system is distinct from new.source_system
       or old.profile_key is distinct from new.profile_key
       or old.source_key is distinct from new.source_key
       or old.target_table is distinct from new.target_table
       or old.target_id is distinct from new.target_id
       or not exists(
         select 1 from public.legacy_import_batches prior
         join public.legacy_import_batches current_batch on current_batch.id=new.batch_id
         where prior.id=old.batch_id
           and prior.parish_id=current_batch.parish_id
       )
    ) then
      raise exception 'V217 prohibido reasignar la procedencia histórica a otra parroquia o partida';
    end if;
    if not (
      (new.target_table in ('baptism','baptisms') and exists (
        select 1 from public.baptisms t join public.legacy_import_batches b on b.id=new.batch_id
        where t.id=new.target_id and t.parish_id=b.parish_id))
      or (new.target_table in ('confirmation','confirmations') and exists (
        select 1 from public.confirmations t join public.legacy_import_batches b on b.id=new.batch_id
        where t.id=new.target_id and t.parish_id=b.parish_id))
      or (new.target_table in ('marriage','marriages') and exists (
        select 1 from public.marriages t join public.legacy_import_batches b on b.id=new.batch_id
        where t.id=new.target_id and t.parish_id=b.parish_id))
      or (new.target_table in ('funeral','funerals') and exists (
        select 1 from public.funerals t join public.legacy_import_batches b on b.id=new.batch_id
        where t.id=new.target_id and t.parish_id=b.parish_id))
      or (new.target_table='pending_baptisms' and exists (
        select 1 from public.pending_baptisms t join public.legacy_import_batches b on b.id=new.batch_id
        where t.id=new.target_id and t.parish_id=b.parish_id))
      or (new.target_table='pending_confirmations' and exists (
        select 1 from public.pending_confirmations t join public.legacy_import_batches b on b.id=new.batch_id
        where t.id=new.target_id and t.parish_id=b.parish_id))
      or (new.target_table='pending_marriages' and exists (
        select 1 from public.pending_marriages t join public.legacy_import_batches b on b.id=new.batch_id
        where t.id=new.target_id and t.parish_id=b.parish_id))
      or (new.target_table='pending_funerals' and exists (
        select 1 from public.pending_funerals t join public.legacy_import_batches b on b.id=new.batch_id
        where t.id=new.target_id and t.parish_id=b.parish_id))
      or (new.target_table='marginal_notes' and exists (
        select 1 from public.marginal_notes t join public.legacy_import_batches b on b.id=new.batch_id
        where t.id=new.target_id and t.parish_id=b.parish_id))
      or (new.target_table='legacy_marginal_note_queue' and exists (
        select 1 from public.legacy_marginal_note_queue t join public.legacy_import_batches b on b.id=new.batch_id
        where t.id=new.target_id and t.parish_id=b.parish_id))
    ) then
      raise exception 'V217 el expediente registral destino no existe en la parroquia de procedencia';
    end if;
  end if;
  select normalized_data into d
  from public.legacy_import_rows
  where id=new.row_id;$new$;
BEGIN
 select pg_catalog.pg_get_functiondef(p.oid) into v_ddl
 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='sacramentum_guard_legacy_record_link_identity'
 limit 1;
 if v_ddl is null then raise exception 'V217 missing source registral link guard'; end if;
 if position('V217 prohibido reasignar la procedencia histórica' in v_ddl)>0 then return;end if;
 if position(v_old in v_ddl)=0 then
    raise exception 'V217 source trigger has changed; refusing unsafe patch';
 end if;
 execute replace(v_ddl,v_old,v_new);
END $migration$;
