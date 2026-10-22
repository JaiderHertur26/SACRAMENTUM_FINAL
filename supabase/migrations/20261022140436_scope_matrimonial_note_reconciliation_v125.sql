-- V125 · No permitir notas matrimoniales fuera de la parroquia autorizada ni reconciliación global.
CREATE OR REPLACE FUNCTION public.reconcile_legacy_matrimonial_notes(p_parish_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q public.legacy_marginal_note_queue%rowtype;
  v_count integer;
  v_marriage uuid;
  v_note uuid;
  v_matched integer:=0;
  v_pending integer:=0;
  v_ambiguous integer:=0;
begin
  if auth.uid() is null then
    raise exception 'Sesión no autenticada' using errcode='42501';
  end if;
  if p_parish_id is null then
    raise exception 'Debe seleccionar una parroquia para conciliar notas históricas' using errcode='42501';
  end if;
  if not public.can_manage_legacy_import(
       p_parish_id,
       (select diocese_id from public.parishes where id=p_parish_id)
     ) then
    raise exception 'No autorizado para conciliar notas históricas de esta parroquia' using errcode='42501';
  end if;  for q in
    select *
    from public.legacy_marginal_note_queue
    where status in ('pending','ambiguous')
      and (p_parish_id is null or parish_id=p_parish_id)
    order by created_at,id
    for update
  loop
    select count(*)::integer
      into v_count
    from public.marriages m
    where m.parish_id=q.parish_id
      and public.sacramentum_registry_ref(m.book_number)=q.book_number
      and public.sacramentum_registry_ref(m.folio)=q.folio
      and public.sacramentum_registry_ref(m.number)=q.number;

    v_marriage:=null;
    if v_count=1 then
      select m.id into v_marriage
      from public.marriages m
      where m.parish_id=q.parish_id
        and public.sacramentum_registry_ref(m.book_number)=q.book_number
        and public.sacramentum_registry_ref(m.folio)=q.folio
        and public.sacramentum_registry_ref(m.number)=q.number
      limit 1;
      select id into v_note
      from public.marginal_notes
      where source_type='legacy_matrimonial_note'
        and source_id=q.id
      limit 1;

      if v_note is null then
        insert into public.marginal_notes(
          sacrament_type,note_type,content,parish_id,sacrament_id,note_date,
          source_type,source_id,created_by,status,print_policy,print_default,
          is_locked,print_label,legacy_source,created_at
        ) values (
          'matrimonio',
          'legacy_historical',
          q.content,
          q.parish_id,
          v_marriage,
          null,
          'legacy_matrimonial_note',
          q.id,
          q.created_by,
          'active',
          'internal',
          false,
          true,
          'Nota histórica importada',
          jsonb_build_object(
            'profile_key',q.profile_key,
            'source_sha256',q.source_sha256,
            'source_key',q.source_key,
            'batch_id',q.batch_id,
            'row_id',q.row_id,
            'legacy_dafe_code',q.legacy_dafe_code,
            'source_updated_at',q.source_updated_at,
            'classification',q.classification,
            'historical_note_date_unknown',true,
            'original_data',q.original_data
          ),
          coalesce(q.source_updated_at,now())
        )
        returning id into v_note;
      end if;      update public.legacy_marginal_note_queue
      set status='matched',
          matched_record_id=v_marriage,
          marginal_note_id=v_note,
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'match_method','book_folio_number_exact',
            'matched_at',now()
          ),
          updated_at=now()
      where id=q.id;
      v_matched:=v_matched+1;

    elsif v_count=0 then
      update public.legacy_marginal_note_queue
      set status='pending',
          matched_record_id=null,
          marginal_note_id=null,
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'match_method','book_folio_number_exact',
            'last_checked_at',now()
          ),
          updated_at=now()
      where id=q.id;
      v_pending:=v_pending+1;

    else
      update public.legacy_marginal_note_queue
      set status='ambiguous',
          matched_record_id=null,
          marginal_note_id=null,
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'match_method','book_folio_number_exact',
            'candidate_count',v_count,
            'last_checked_at',now()
          ),
          updated_at=now()
      where id=q.id;
      v_ambiguous:=v_ambiguous+1;
    end if;
  end loop;

  return jsonb_build_object(
    'matched',v_matched,
    'pending',v_pending,
    'ambiguous',v_ambiguous,
    'total_matched',(select count(*) from public.legacy_marginal_note_queue where status='matched' and (p_parish_id is null or parish_id=p_parish_id)),
    'total_pending',(select count(*) from public.legacy_marginal_note_queue where status='pending' and (p_parish_id is null or parish_id=p_parish_id)),
    'total_ambiguous',(select count(*) from public.legacy_marginal_note_queue where status='ambiguous' and (p_parish_id is null or parish_id=p_parish_id))
  );
end;
$function$
;
