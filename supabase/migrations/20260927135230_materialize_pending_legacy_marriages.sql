-- SACRAMENTUM V65
-- Materializa INSMATRI en expedientes matrimoniales modernos sin duplicar matrimonios ya asentados.

create or replace function private.materialize_pending_legacy_marriages(
  p_batch_id uuid,
  p_limit integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.legacy_import_batches%rowtype;
  r public.legacy_import_rows%rowtype;
  d jsonb;
  v_target uuid;
  v_match uuid;
  v_match_count integer;
  v_source_key text;
  v_raw jsonb;
  v_date date;
  v_imported integer := 0;
  v_reconciled integer := 0;
  v_reviewed integer := 0;
  v_remaining integer := 0;
  v_groom_status text;
  v_bride_status text;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;

  select * into v_batch
  from public.legacy_import_batches
  where id=p_batch_id;

  if not found then raise exception 'Lote histórico no encontrado'; end if;
  if v_batch.parish_id is null then raise exception 'El lote no tiene parroquia propietaria'; end if;
  if not public.can_access_parish(v_batch.parish_id) then raise exception 'Fuera de jurisdicción'; end if;
  if upper(coalesce(v_batch.profile_key,'')) <> 'INSMATRI' then
    raise exception 'Este materializador sólo admite INSMATRI';
  end if;

  for r in
    select *
    from public.legacy_import_rows
    where batch_id=p_batch_id
      and status='valid'
      and target_entity='pending_marriage'
    order by row_number
    limit greatest(1,least(coalesce(p_limit,300),1000))
    for update skip locked
  loop
    d:=coalesce(r.normalized_data,'{}'::jsonb);
    v_source_key:=coalesce(r.source_key,r.row_number::text);
    v_target:=null;
    v_match:=null;
    v_match_count:=0;

    select l.target_id into v_target
    from public.legacy_record_links l
    where l.source_system=v_batch.source_system
      and l.profile_key=v_batch.profile_key
      and l.source_key=v_source_key
    limit 1;

    if v_target is not null then
      update public.legacy_import_rows
      set status='duplicate',target_id=v_target,imported_at=coalesce(imported_at,now()),updated_at=now()
      where id=r.id;
      continue;
    end if;

    begin
      v_date:=nullif(left(coalesce(d->>'fecmat',''),10),'')::date;
    exception when others then
      v_date:=null;
    end;

    if coalesce(lower(d->>'bautizado1') in ('true','1','si','sí'),false) then
      v_groom_status:=case when nullif(trim(coalesce(d->>'otrareligi','')),'') is not null
        then 'christian_non_catholic_baptized' else 'catholic_baptized' end;
    elsif lower(coalesce(d->>'bautizado1','')) in ('false','0','no') then
      v_groom_status:='unbaptized';
    else
      v_groom_status:='unknown';
    end if;

    if coalesce(lower(d->>'bautizado2') in ('true','1','si','sí'),false) then
      v_bride_status:=case when nullif(trim(coalesce(d->>'otrarelig2','')),'') is not null
        then 'christian_non_catholic_baptized' else 'catholic_baptized' end;
    elsif lower(coalesce(d->>'bautizado2','')) in ('false','0','no') then
      v_bride_status:='unbaptized';
    else
      v_bride_status:='unknown';
    end if;

    if coalesce(lower(d->>'reported') in ('true','1','si','sí'),false) then
      select count(*), min(m.id::text)::uuid
        into v_match_count,v_match
      from public.marriages m
      where m.parish_id=v_batch.parish_id
        and (v_date is null or m.celebration_date=v_date)
        and upper(trim(coalesce(
          m.raw_data->>'novioNombres',
          m.raw_data->>'groomName',
          m.raw_data->'legacy_normalized'->'party_1'->>'names',
          m.raw_data->>'nombr1',''
        )))=upper(trim(coalesce(d->>'nombres1','')))
        and upper(trim(coalesce(
          m.raw_data->>'novioApellidos',
          m.raw_data->>'groomSurname',
          m.raw_data->'legacy_normalized'->'party_1'->>'last_names',
          m.raw_data->>'apellidos1',''
        )))=upper(trim(coalesce(d->>'apellidos1','')))
        and upper(trim(coalesce(
          m.raw_data->>'noviaNombres',
          m.raw_data->>'brideName',
          m.raw_data->'legacy_normalized'->'party_2'->>'names',
          m.raw_data->>'nombr2',''
        )))=upper(trim(coalesce(d->>'nombres2','')))
        and upper(trim(coalesce(
          m.raw_data->>'noviaApellidos',
          m.raw_data->>'brideSurname',
          m.raw_data->'legacy_normalized'->'party_2'->>'last_names',
          m.raw_data->>'apellidos2',''
        )))=upper(trim(coalesce(d->>'apellidos2','')))
        and lower(coalesce(m.status,'seated')) not in ('annulled','anulada','deleted','reversed','revertida','replaced');

      if v_match_count=1 and v_match is not null then
        v_target:=v_match;
        insert into public.legacy_record_links(
          source_system,profile_key,source_key,checksum,batch_id,row_id,target_table,target_id,metadata
        ) values (
          v_batch.source_system,v_batch.profile_key,v_source_key,r.checksum,p_batch_id,r.id,
          'marriages',v_target,
          jsonb_build_object('filename',v_batch.original_filename,'reconciliation','reported_unique_match')
        )
        on conflict(source_system,profile_key,source_key)
        do update set checksum=excluded.checksum,batch_id=excluded.batch_id,row_id=excluded.row_id,
          target_table=excluded.target_table,target_id=excluded.target_id,metadata=excluded.metadata,updated_at=now();

        update public.legacy_import_rows
        set status='imported',target_table='marriages',target_id=v_target,imported_at=now(),
            issue_codes=array_remove(coalesce(issue_codes,'{}'::text[]),'REPORTED_LEGACY_RECORD'),
            issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object('reconciliation','unique_celebrated_match'),
            updated_at=now()
        where id=r.id;
        v_reconciled:=v_reconciled+1;
      else
        update public.legacy_import_rows
        set status='review',
            issue_codes=array_append(
              array_remove(coalesce(issue_codes,'{}'::text[]),'REPORTED_LEGACY_RECORD'),
              case when v_match_count=0 then 'REPORTED_MARRIAGE_NOT_FOUND' else 'REPORTED_MARRIAGE_AMBIGUOUS' end
            ),
            issue_details=coalesce(issue_details,'{}'::jsonb)||jsonb_build_object(
              'reconciliation','manual_required','candidate_count',v_match_count
            ),
            updated_at=now()
        where id=r.id;
        v_reviewed:=v_reviewed+1;
      end if;
      continue;
    end if;

    v_raw:=coalesce(r.original_data,'{}'::jsonb)
      || jsonb_build_object(
        'legacy_normalized',d,
        'source','legacy_import',
        'sourceFlow','legacy_pending_marriage',
        'numeroRegistro',coalesce(d->>'numero',''),
        'fechaExpediente',coalesce(d->>'fecins',''),
        'fechaHoraPrevista',coalesce(d->>'fecmat',''),
        'fechaSacramento',coalesce(left(d->>'fecmat',10),''),
        'lugarCeremonia',coalesce(d->>'lugmat',''),
        'presenciaria',coalesce(d->>'ministro','')
      )
      || jsonb_build_object(
        'novioApellidos',coalesce(d->>'apellidos1',''),
        'novioNombres',coalesce(d->>'nombres1',''),
        'novioCedula',coalesce(d->>'cedula1',''),
        'novioExpedida',coalesce(d->>'expedida1',''),
        'novioEcclesialStatus',v_groom_status,
        'novioBautizado',coalesce(lower(d->>'bautizado1') in ('true','1','si','sí'),false),
        'novioBautismoLugar',coalesce(d->>'codbaut1',''),
        'novioBautismoLibro',coalesce(d->>'libro1',''),
        'novioBautismoFolio',coalesce(d->>'folio1',''),
        'novioBautismoNumero',coalesce(d->>'numero1',''),
        'novioBautismoFecha',coalesce(d->>'fecbau1',''),
        'novioFechaNac',coalesce(d->>'fecnac1',''),
        'novioLugarNac',coalesce(d->>'lugnac1',''),
        'novioPadre',coalesce(d->>'padre1',''),
        'novioMadre',coalesce(d->>'madre1',''),
        'novioOcupacion',coalesce(d->>'ocupacion1',''),
        'novioEmpresa',coalesce(d->>'empresa1',''),
        'novioDireccion',coalesce(d->>'dir_res1',''),
        'novioCiudad',coalesce(d->>'ciudad1',''),
        'novioTelefonos',coalesce(d->>'telefonos1',''),
        'novioConfirmado',coalesce(lower(d->>'confirmado') in ('true','1','si','sí'),false),
        'novioConfirmacionLugar',coalesce(d->>'codconf1',''),
        'novioReligion',coalesce(d->>'otrareligi','')
      )
      || jsonb_build_object(
        'novioPreviousCatholicMarriage',coalesce(d->>'matcatol1',''),
        'novioPreviousCivilMarriage',coalesce(d->>'matcivil1',''),
        'novioPriorMarriageDocumentNumber',coalesce(d->>'numdoc1',''),
        'novioPriorMarriageDocumentDate',coalesce(d->>'fecdoc1',''),
        'novioPriorMarriageDocumentIssuer',coalesce(d->>'expidedoc1',''),
        'noviaApellidos',coalesce(d->>'apellidos2',''),
        'noviaNombres',coalesce(d->>'nombres2',''),
        'noviaCedula',coalesce(d->>'cedula2',''),
        'noviaExpedida',coalesce(d->>'expedida2',''),
        'noviaEcclesialStatus',v_bride_status,
        'noviaBautizada',coalesce(lower(d->>'bautizado2') in ('true','1','si','sí'),false),
        'noviaBautismoLugar',coalesce(d->>'codbaut2',''),
        'noviaBautismoLibro',coalesce(d->>'libro2',''),
        'noviaBautismoFolio',coalesce(d->>'folio2',''),
        'noviaBautismoNumero',coalesce(d->>'numero2',''),
        'noviaBautismoFecha',coalesce(d->>'fecbau2',''),
        'noviaFechaNac',coalesce(d->>'fecnac2',''),
        'noviaLugarNac',coalesce(d->>'lugnac2',''),
        'noviaPadre',coalesce(d->>'padre2',''),
        'noviaMadre',coalesce(d->>'madre2',''),
        'noviaOcupacion',coalesce(d->>'ocupacion2',''),
        'noviaEmpresa',coalesce(d->>'empresa2',''),
        'noviaDireccion',coalesce(d->>'dir_res2',''),
        'noviaCiudad',coalesce(d->>'ciudad2',''),
        'noviaTelefonos',coalesce(d->>'telefonos2','')
      )
      || jsonb_build_object(
        'noviaConfirmada',coalesce(lower(d->>'confirmad2') in ('true','1','si','sí'),false),
        'noviaConfirmacionLugar',coalesce(d->>'codconf2',''),
        'noviaReligion',coalesce(d->>'otrarelig2',''),
        'noviaPreviousCatholicMarriage',coalesce(d->>'matcatol2',''),
        'noviaPreviousCivilMarriage',coalesce(d->>'matcivil2',''),
        'noviaPriorMarriageDocumentNumber',coalesce(d->>'numdoc2',''),
        'noviaPriorMarriageDocumentDate',coalesce(d->>'fecdoc2',''),
        'noviaPriorMarriageDocumentIssuer',coalesce(d->>'expidedoc2',''),
        'testigo1Nombres',coalesce(d->>'dtnombre1',''),
        'testigo1Cedula',coalesce(d->>'dtcedula1',''),
        'testigo1Expedida',coalesce(d->>'dtexpedida',''),
        'testigo1Direccion',coalesce(d->>'dtdireccio',''),
        'testigo1Telefono',coalesce(d->>'dttelefono',''),
        'testigo1Ciudad',coalesce(d->>'dtciudad1',''),
        'testigo2Nombres',coalesce(d->>'dtnombre2',''),
        'testigo2Cedula',coalesce(d->>'dtcedula2',''),
        'testigo2Expedida',coalesce(d->>'dtexpedid2',''),
        'testigo2Direccion',coalesce(d->>'dtdirecci2',''),
        'testigo2Telefono',coalesce(d->>'dttelefon2',''),
        'testigo2Ciudad',coalesce(d->>'dtciudad2',''),
        'porDecreto',coalesce(lower(d->>'pordecreto') in ('true','1','si','sí'),false),
        'decretoNumero',coalesce(d->>'numdecreto',''),
        'decretoFecha',coalesce(d->>'fecdecreto',''),
        'decretoExpedido',coalesce(d->>'expdecreto','')
      )
      || jsonb_build_object(
        'legacyInterview',jsonb_build_object(
          'party1Declaration',coalesce(d->>'declara1',''),
          'party2Declaration',coalesce(d->>'declara2',''),
          'witness1Declaration',coalesce(d->>'dtdeclara1',''),
          'witness2Declaration',coalesce(d->>'dtdeclara2','')
        )
      );

    insert into public.pending_marriages(parish_id,status,reportado,celebration_date,raw_data)
    values(v_batch.parish_id,'pending',false,v_date,v_raw)
    returning id into v_target;

    insert into public.legacy_record_links(
      source_system,profile_key,source_key,checksum,batch_id,row_id,target_table,target_id,metadata
    ) values (
      v_batch.source_system,v_batch.profile_key,v_source_key,r.checksum,p_batch_id,r.id,
      'pending_marriages',v_target,
      jsonb_build_object('filename',v_batch.original_filename,'materialization','pending')
    )
    on conflict(source_system,profile_key,source_key)
    do update set checksum=excluded.checksum,batch_id=excluded.batch_id,row_id=excluded.row_id,
      target_table=excluded.target_table,target_id=excluded.target_id,metadata=excluded.metadata,updated_at=now();

    update public.legacy_import_rows
    set status='imported',target_table='pending_marriages',target_id=v_target,imported_at=now(),updated_at=now()
    where id=r.id;
    v_imported:=v_imported+1;
  end loop;

  select count(*) into v_remaining
  from public.legacy_import_rows
  where batch_id=p_batch_id and status='valid' and target_entity='pending_marriage';

  update public.legacy_import_batches b
  set imported_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='imported'),
      valid_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='valid'),
      review_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='review'),
      error_count=(select count(*) from public.legacy_import_rows where batch_id=p_batch_id and status='error'),
      status=case
        when v_remaining>0 then 'ready'
        when exists(select 1 from public.legacy_import_rows where batch_id=p_batch_id and status='review') then 'completed_with_review'
        else 'completed'
      end,
      updated_at=now()
  where b.id=p_batch_id;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_batch.parish_id,v_batch.diocese_id,'legacy_import_batch',p_batch_id,
    'legacy_marriage_pending_materialized',
    jsonb_build_object('pending_created',v_imported,'reported_reconciled',v_reconciled,'manual_review',v_reviewed),
    jsonb_build_object('profile_key','INSMATRI','remaining',v_remaining)
  );

  return jsonb_build_object(
    'imported',v_imported,'reconciled',v_reconciled,'reviewed',v_reviewed,'remaining',v_remaining
  );
end;
$$;

revoke all on function private.materialize_pending_legacy_marriages(uuid,integer) from public;
revoke all on function private.materialize_pending_legacy_marriages(uuid,integer) from anon;
grant execute on function private.materialize_pending_legacy_marriages(uuid,integer) to authenticated;

create or replace function public.materialize_pending_legacy_marriages(
  p_batch_id uuid,
  p_limit integer default 300
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.materialize_pending_legacy_marriages(p_batch_id,p_limit);
$$;

revoke all on function public.materialize_pending_legacy_marriages(uuid,integer) from public;
revoke all on function public.materialize_pending_legacy_marriages(uuid,integer) from anon;
grant execute on function public.materialize_pending_legacy_marriages(uuid,integer) to authenticated;

comment on function public.materialize_pending_legacy_marriages(uuid,integer)
is 'Materializa INSMATRI: reported=false crea expediente matrimonial moderno; reported=true sólo concilia contra una partida única.';
