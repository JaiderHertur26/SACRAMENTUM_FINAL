-- V215. Existing historical marriage source keys must NEVER refer to another parish.
-- Preserve in-place private materializer, privileges and all legal document semantics.
DO $migration$
DECLARE
  v_ddl text;
  v_old_lookup text := $old$    select l.target_id into v_target
    from public.legacy_record_links l
    where l.source_system=v_batch.source_system
      and l.profile_key=v_batch.profile_key
      and l.source_key=v_source_key
    limit 1;$old$;
  v_new_lookup text := $new$    -- A globally unique source_key is not a jurisdiction: serialize identical
    -- keys and verify both the original batch AND the referenced marriage.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        v_batch.source_system || ':' || v_batch.profile_key || ':' || v_source_key,0
      )
    );
    if exists(
      select 1 from public.legacy_record_links l
      left join public.legacy_import_batches prior on prior.id=l.batch_id
      where l.source_system=v_batch.source_system
        and l.profile_key=v_batch.profile_key
        and l.source_key=v_source_key
        and (
          prior.parish_id is distinct from v_batch.parish_id
          or l.target_table not in ('pending_marriages','marriages')
          or (l.target_table='pending_marriages' and not exists(
            select 1 from public.pending_marriages pm
            where pm.id=l.target_id and pm.parish_id=v_batch.parish_id
          ))
          or (l.target_table='marriages' and not exists(
            select 1 from public.marriages m
            where m.id=l.target_id and m.parish_id=v_batch.parish_id
          ))
        )
    ) then
      raise exception 'Clave histórica matrimonial vinculada a otra parroquia o expediente. Revise la procedencia.';
    end if;
    select l.target_id into v_target
    from public.legacy_record_links l
    where l.source_system=v_batch.source_system
      and l.profile_key=v_batch.profile_key
      and l.source_key=v_source_key
    limit 1;$new$;
  v_old_reported text := $old$    if coalesce(lower(d->>'reported') in ('true','1','si','sí'),false) then
      select count(*), min(m.id::text)::uuid$old$;
  v_new_reported text := $new$    if coalesce(lower(d->>'reported') in ('true','1','si','sí'),false) then
      -- A name-only or unnamed match must never be promoted to a sacrament.
      -- Unlike unreported preinscriptions, no new pending is created here.
      if v_date is null
        or nullif(btrim(coalesce(d->>'nombres1','')),'') is null
        or nullif(btrim(coalesce(d->>'apellidos1','')),'') is null
        or nullif(btrim(coalesce(d->>'nombres2','')),'') is null
        or nullif(btrim(coalesce(d->>'apellidos2','')),'') is null then
        update public.legacy_import_rows
        set status='review',
            issue_codes=array_append(
              array_remove(coalesce(issue_codes,'{}'::text[]),'REPORTED_LEGACY_RECORD'),
              'REPORTED_MARRIAGE_IDENTITY_INSUFFICIENT'
            ),
            issue_details=coalesce(issue_details,'{}'::jsonb)
              || jsonb_build_object('reconciliation','manual_required',
                'reason','missing_spouse_names_or_celebration_date'),
            updated_at=now()
        where id=r.id;
        v_reviewed:=v_reviewed+1;
        continue;
      end if;
      select count(*), min(m.id::text)::uuid$new$;
BEGIN
  select pg_catalog.pg_get_functiondef(p.oid) into v_ddl
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='materialize_pending_legacy_marriages'
    and pg_catalog.pg_get_function_identity_arguments(p.oid)='p_batch_id uuid, p_limit integer'
  limit 1;
  if v_ddl is null then raise exception 'V215 function missing or changed';end if;
  if position('REPORTED_MARRIAGE_IDENTITY_INSUFFICIENT' in v_ddl)>0
     and position('Clave histórica matrimonial vinculada a otra parroquia' in v_ddl)>0 then
    return;
  end if;
  if position(v_old_lookup in v_ddl)=0 or position(v_old_reported in v_ddl)=0 then
    raise exception 'V215 unexpected marriage materializer: do not modify without source review';
  end if;
  v_ddl := replace(replace(v_ddl,v_old_lookup,v_new_lookup),v_old_reported,v_new_reported);
  execute v_ddl;
END $migration$;
