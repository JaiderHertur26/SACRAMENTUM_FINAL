begin;

create unique index if not exists uq_diocesis_legacy_identity_per_parish
on public.diocesis(parish_id,codigo,(lower(nombre)))
where nullif(codigo,'') is not null;

create or replace function public.materialize_diocesis_catalog_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  b public.legacy_import_batches%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_count integer:=0;
begin
  select * into b from public.legacy_import_batches where id=p_batch_id;
  if not found then raise exception 'Lote no encontrado'; end if;
  if b.parish_id is null then raise exception 'La parroquia propietaria es obligatoria'; end if;

  if b.profile_key<>'DIOCESIS' then
    return jsonb_build_object('profile',b.profile_key,'materialized',0,'skipped',true);
  end if;

  if auth.uid() is not null and not public.can_manage_legacy_import(b.parish_id,b.diocese_id) then
    raise exception 'No autorizado para materializar este lote';
  end if;

  for r in
    select * from public.legacy_import_rows
    where batch_id=p_batch_id and status='imported'
    order by row_number
  loop
    d:=coalesce(r.normalized_data,'{}'::jsonb);
    if nullif(d->>'name','') is not null then
      insert into public.diocesis(
        parish_id,codigo,nombre,region,descripcion,created_at,updated_at
      ) values(
        b.parish_id,
        nullif(d->>'legacy_code',''),
        upper(trim(d->>'name')),
        upper(trim(coalesce(d->>'city',''))),
        concat_ws(' · ',
          nullif(trim(coalesce(d->>'address','')),''),
          nullif(trim(coalesce(d->>'phone','')),''),
          nullif(trim(coalesce(d->>'email','')),'')
        ),
        now(),now()
      )
      on conflict(parish_id,codigo,(lower(nombre)))
      where nullif(codigo,'') is not null
      do update set
        region=excluded.region,
        descripcion=excluded.descripcion,
        updated_at=now();
      v_count:=v_count+1;
    end if;
  end loop;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values(
    auth.uid(),b.parish_id,b.diocese_id,'legacy_import_batch',p_batch_id,
    'auxiliary_catalog_materialized',
    jsonb_build_object('profile_key','DIOCESIS','materialized',v_count),
    jsonb_build_object('filename',b.original_filename,'sha256',b.sha256)
  );

  return jsonb_build_object(
    'profile','DIOCESIS','materialized',v_count,'parish_id',b.parish_id
  );
end;
$$;

revoke all on function public.materialize_diocesis_catalog_batch(uuid) from public,anon;
grant execute on function public.materialize_diocesis_catalog_batch(uuid) to authenticated,service_role;

commit;
