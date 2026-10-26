-- V216: audited ownership and physical sacrament isolation for historical marginal notes.
-- No existing marginal notes or sacraments are rewritten by this migration.
DO $migration$
DECLARE
 v_ddl text;
 v_old text := $old$      select l.target_id into v_existing
      from public.legacy_record_links l
      where l.source_system=v_batch.source_system
        and l.profile_key=v_batch.profile_key
        and l.source_key=v_source_key
        and l.target_table='marginal_notes'
      limit 1;$old$;
 v_new text := $new$      -- Global legacy keys may repeat in multiple parishes. Prevent even
      -- concurrent imports from reusing an unrelated note or its sacrament.
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
          v_batch.source_system || ':' || v_batch.profile_key || ':' || v_source_key,0
        )
      );
      if exists (
        select 1
        from public.legacy_record_links l
        left join public.legacy_import_batches prior on prior.id=l.batch_id
        left join public.marginal_notes mn
          on mn.id=l.target_id and l.target_table='marginal_notes'
        where l.source_system=v_batch.source_system
          and l.profile_key=v_batch.profile_key
          and l.source_key=v_source_key
          and (
            prior.parish_id is distinct from v_batch.parish_id
            or l.target_table is distinct from 'marginal_notes'
            or mn.id is null
            or mn.parish_id is distinct from v_batch.parish_id
            or mn.sacrament_type is distinct from v_sacrament
            or not (
              (v_sacrament='bautismo' and exists (
                select 1 from public.baptisms target
                where target.id=mn.sacrament_id
                  and target.parish_id=v_batch.parish_id
                  and public.sacramentum_registry_ref(target.book_number)=v_book
                  and public.sacramentum_registry_ref(target.folio)=v_folio
                  and public.sacramentum_registry_ref(target.number)=v_number))
              or (v_sacrament='confirmacion' and exists (
                select 1 from public.confirmations target
                where target.id=mn.sacrament_id
                  and target.parish_id=v_batch.parish_id
                  and public.sacramentum_registry_ref(target.book_number)=v_book
                  and public.sacramentum_registry_ref(target.folio)=v_folio
                  and public.sacramentum_registry_ref(target.number)=v_number))
              or (v_sacrament='matrimonio' and exists (
                select 1 from public.marriages target
                where target.id=mn.sacrament_id
                  and target.parish_id=v_batch.parish_id
                  and public.sacramentum_registry_ref(target.book_number)=v_book
                  and public.sacramentum_registry_ref(target.folio)=v_folio
                  and public.sacramentum_registry_ref(target.number)=v_number))
              or (v_sacrament='exequias' and exists (
                select 1 from public.funerals target
                where target.id=mn.sacrament_id
                  and target.parish_id=v_batch.parish_id
                  and public.sacramentum_registry_ref(target.book_number)=v_book
                  and public.sacramentum_registry_ref(target.folio)=v_folio
                  and public.sacramentum_registry_ref(target.number)=v_number))
            )
          )
      ) then
        raise exception 'Nota marginal histórica vinculada a otra parroquia o partida. Requiere revisión de procedencia.';
      end if;
      select l.target_id into v_existing
      from public.legacy_record_links l
      where l.source_system=v_batch.source_system
        and l.profile_key=v_batch.profile_key
        and l.source_key=v_source_key
        and l.target_table='marginal_notes'
      limit 1;$new$;
BEGIN
 select pg_catalog.pg_get_functiondef(p.oid) into v_ddl
 from pg_catalog.pg_proc p
 join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='apply_legacy_marginal_note_batch'
   and pg_catalog.pg_get_function_identity_arguments(p.oid)='p_batch_id uuid, p_limit integer'
 limit 1;
 if v_ddl is null then
   raise exception 'V216 expected marginal note importer missing';
 end if;
 if position('Nota marginal histórica vinculada a otra parroquia' in v_ddl)>0 then
   return;
 end if;
 if position(v_old in v_ddl)=0 then
   raise exception 'V216 original note importer changed, refusing unsafe replacement';
 end if;
 execute replace(v_ddl,v_old,v_new);
END $migration$;
