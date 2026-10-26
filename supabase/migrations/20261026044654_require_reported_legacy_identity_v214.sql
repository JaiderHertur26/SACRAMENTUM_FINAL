-- V214: Reported historical boletas require identity and date evidence before auto-linking.
-- Applied to INSBAUTI and INSCONFI, preserving V213 parish/scope protection.
DO $migration$
DECLARE
  v_ddl text;
  v_old text := $needle$    if coalesce((d->>'reported')::boolean,false) then
      -- Una boleta reportada ya debería tener partida: nunca crear otro pendiente.$needle$;
  v_new text := $replacement$    if coalesce((d->>'reported')::boolean,false) then
      -- Names alone are never sufficient to join a historical boleta to a
      -- sacramental record. Require both names and one corroborating date.
      -- On incomplete evidence, always refer to Cancillería for manual review.
      if nullif(btrim(coalesce(d->>'names','')),'') is null
         or nullif(btrim(coalesce(d->>'last_names','')),'') is null
         or (v_date is null and v_birth is null) then
        update public.legacy_import_rows
        set status='review',
            issue_codes=array_append(
              array_remove(coalesce(issue_codes,'{}'::text[]),'LEGACY_BOLETA_REPORTED'),
              'REPORTED_IDENTITY_INSUFFICIENT'
            ),
            issue_details=coalesce(issue_details,'{}'::jsonb)
              || jsonb_build_object(
                'reconciliation','manual_required',
                'reason','missing_full_name_or_verifiable_date'
              ),
            updated_at=now()
        where id=r.id;
        v_reviewed := v_reviewed + 1;
        continue;
      end if;
      -- Una boleta reportada ya debería tener partida: nunca crear otro pendiente.$replacement$;
BEGIN
  select pg_catalog.pg_get_functiondef(p.oid) into v_ddl
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='materialize_pending_legacy_sacramental_records'
    and pg_catalog.pg_get_function_identity_arguments(p.oid)='p_batch_id uuid, p_limit integer'
  limit 1;
  if v_ddl is null then
    raise exception 'V214 materializer changed or missing; no changes applied';
  end if;
  if position('REPORTED_IDENTITY_INSUFFICIENT' in v_ddl)>0 then return; end if;
  if position('Clave histórica vinculada a otra parroquia' in v_ddl)=0 then
    raise exception 'V214 requires the V213 parish isolation guard';
  end if;
  if position(v_old in v_ddl)=0 then
    raise exception 'V214 source function changed; manual audit required';
  end if;
  execute replace(v_ddl,v_old,v_new);
END $migration$;
