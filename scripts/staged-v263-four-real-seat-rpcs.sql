BEGIN;
-- SACRAMENTUM V263 STAGED · FOUR REAL-TABLE SEAT RPC CANDIDATES.
-- DO NOT RUN AGAINST SUPABASE until reviewed cutover, source reconciliation,
-- attestations workflow, full fixture coverage and replacement of old RPCs.
-- Depends on PRIVATE V252/V253 kernel, V260 unique physical slots.
-- No direct client grants in this staged artifact.
CREATE TABLE sacramentum_ledger.celebration_attestations_v263 (
 pending_id uuid PRIMARY KEY,
 parish_id uuid NOT NULL,
 sacrament text NOT NULL CHECK(sacrament IN ('bautismo','confirmacion','matrimonio','exequias')),
 origin text NOT NULL CHECK(origin IN ('new_sacrament','new_decree_supplement')),
 verified_at timestamptz NOT NULL,
 verified_by uuid NOT NULL,
 evidence_ref text NOT NULL CHECK(length(btrim(evidence_ref)) BETWEEN 4 AND 120),
 decree_id uuid,
 decree_effect text,
 CHECK(origin<>'new_decree_supplement' OR
   (decree_id IS NOT NULL AND decree_effect='create_supplementary_record'))
);
ALTER TABLE sacramentum_ledger.celebration_attestations_v263 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_ledger.celebration_attestations_v263 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION sacramentum_ledger.real_seat_v263(
 p_parish_id uuid,p_sacrament text,p_book_id uuid,p_expected_version bigint,
 p_expected_folio integer,p_expected_partida integer,
 p_operation_id uuid,p_pending_ids jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 m sacramentum_ledger.book_memories%rowtype;
 evidence sacramentum_ledger.celebration_attestations_v263%rowtype;
 v_auth uuid:=auth.uid();
 v_diocese uuid;
 v_pending_table text;
 v_registry_table text;
 v_pending jsonb;
 v_raw jsonb;
 v_pending_id uuid;
 v_date date;
 v_date_text text;
 v_registration text;
 v_source jsonb;
 v_items jsonb:='[]'::jsonb;
 v_seat jsonb;
 v_result jsonb;
 v_record uuid;
 v_baptism uuid;
 v_note text;
 v_baptism_existing text;
 v_key text;
 v_seen uuid[]:=ARRAY[]::uuid[];
 v_count integer;
 v_folio integer;
 v_partida integer;
 v_book text;
 v_current jsonb;
BEGIN
 IF v_auth IS NULL OR p_parish_id IS NULL OR p_book_id IS NULL OR p_operation_id IS NULL THEN
   RAISE EXCEPTION 'V263: identificación y sesión obligatorias';
 END IF;
 IF NOT EXISTS(
 SELECT 1 FROM public.user_profiles up
 JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
 WHERE up.auth_user_id=v_auth AND up.parish_id=p_parish_id
   AND lower(up.role)='parish' AND up.is_active IS TRUE
   AND upper(coalesce(up.status,''))='ACTIVE'
   AND up.diocese_id IS NOT NULL
 ) THEN RAISE EXCEPTION 'V263: parroquia no autorizada'; END IF;
 SELECT diocese_id INTO v_diocese FROM public.parishes WHERE id=p_parish_id;
 v_pending_table:=CASE p_sacrament
  WHEN 'bautismo' THEN 'pending_baptisms'
  WHEN 'confirmacion' THEN 'pending_confirmations'
  WHEN 'matrimonio' THEN 'pending_marriages'
  WHEN 'exequias' THEN 'pending_funerals' ELSE NULL END;
 v_registry_table:=CASE p_sacrament
  WHEN 'bautismo' THEN 'baptisms'
  WHEN 'confirmacion' THEN 'confirmations'
  WHEN 'matrimonio' THEN 'marriages'
  WHEN 'exequias' THEN 'funerals' ELSE NULL END;
 IF v_pending_table IS NULL OR p_pending_ids IS NULL
   OR jsonb_typeof(p_pending_ids)<>'array'
   OR jsonb_array_length(p_pending_ids) NOT BETWEEN 1 AND 500 THEN
   RAISE EXCEPTION 'V263: sacramento o selección inválida';
 END IF;
 -- Shared lock serializes all seats of one book. The V260 unique indexes also
 -- protect against any DIFFERENT physical writer not using this lock.
 SELECT * INTO m FROM sacramentum_ledger.book_memories
  WHERE id=p_book_id FOR UPDATE;
 IF NOT FOUND OR m.parish_id<>p_parish_id OR m.sacrament<>p_sacrament
   OR NOT m.legacy_reconciled OR m.retired_at IS NOT NULL
   OR m.closed_at IS NOT NULL
   OR m.version IS DISTINCT FROM p_expected_version
   OR m.first_folio+m.active_count/m.partidas_per_folio<>p_expected_folio
   OR (CASE WHEN m.restart_partida_each_folio AND m.active_count>=m.partidas_per_folio
       THEN 1+m.active_count%m.partidas_per_folio
       ELSE m.first_partida+m.active_count END)<>p_expected_partida THEN
   RAISE EXCEPTION 'V263: libro no conciliado, ajeno o posición ya cambiada';
 END IF;
 IF EXISTS(SELECT 1 FROM sacramentum_ledger.seat_operations
    WHERE operation_id=p_operation_id) THEN
   RAISE EXCEPTION 'V263: operación ya registrada; consultar asiento, no duplicar';
 END IF;
 FOR v_key IN SELECT jsonb_array_elements_text(p_pending_ids) LOOP
   IF v_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
     RAISE EXCEPTION 'V263: boleta inválida';
   END IF;
   v_pending_id:=v_key::uuid;
   IF v_pending_id=ANY(v_seen) THEN RAISE EXCEPTION 'V263: boleta duplicada'; END IF;
   v_seen:=array_append(v_seen,v_pending_id);
   EXECUTE format('SELECT to_jsonb(p) FROM public.%I p
     WHERE p.id=$1 AND p.parish_id=$2 FOR UPDATE',v_pending_table)
      INTO v_pending USING v_pending_id,p_parish_id;
   IF v_pending IS NULL OR lower(coalesce(v_pending->>'status',''))<>'pending'
      OR coalesce((v_pending->>'reportado')::boolean,false) THEN
      RAISE EXCEPTION 'V263: boleta no disponible';
   END IF;
   SELECT * INTO evidence FROM sacramentum_ledger.celebration_attestations_v263
     WHERE pending_id=v_pending_id FOR UPDATE;
   IF NOT FOUND OR evidence.parish_id<>p_parish_id
      OR evidence.sacrament<>p_sacrament OR evidence.verified_at>clock_timestamp()
      OR evidence.verified_by IS NULL THEN
      RAISE EXCEPTION 'V263: falta certificación institucional de celebración';
   END IF;
   IF (evidence.origin='new_sacrament' AND m.book_type<>'ordinario')
      OR (evidence.origin='new_decree_supplement' AND
         (m.book_type<>'suplementario' OR evidence.decree_id IS NULL
          OR evidence.decree_effect<>'create_supplementary_record')) THEN
     RAISE EXCEPTION 'V263: origen o mandato de libro supletorio incompatible';
   END IF;
   v_raw:=coalesce(v_pending->'raw_data','{}'::jsonb);
   IF jsonb_typeof(v_raw)<>'object' OR
      EXISTS(SELECT 1 FROM jsonb_object_keys(v_raw) as k
        WHERE k IN ('book_number','Libro','libro','folio','page_number',
                    'number','numero','entry_number')
          AND nullif(btrim(v_raw->>k),'') IS NOT NULL
          AND NOT (p_sacrament='matrimonio' AND k='numero'
            AND v_raw->>'numero'=coalesce(v_raw->>'numeroRegistro',v_raw->>'numero_registro'))
      ) THEN
     RAISE EXCEPTION 'V263: boleta con coordenadas previas o datos inválidos';
   END IF;
   v_date_text:=coalesce(nullif(v_pending->>'celebration_date',''),
      nullif(v_pending->>'fecha_exequias',''),nullif(v_raw->>'celebration_date',''),
      nullif(v_raw->>'fechaSacramento',''),nullif(v_raw->>'fechaMatrimonio',''),
      nullif(v_raw->>'fecha_exequias',''));
   IF v_date_text IS NULL OR v_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
     RAISE EXCEPTION 'V263: fecha de celebración no acreditada'; END IF;
   BEGIN v_date:=v_date_text::date;
   EXCEPTION WHEN others THEN RAISE EXCEPTION 'V263: fecha imposible'; END;
   IF to_char(v_date,'YYYY-MM-DD')<>v_date_text OR v_date>current_date THEN
     RAISE EXCEPTION 'V263: celebración posterior a hoy'; END IF;
   v_registration:=coalesce(nullif(v_pending->>'numero_registro',''),
       nullif(v_raw->>'numero_registro',''),nullif(v_raw->>'numeroRegistro',''));
   IF v_registration IS NULL OR v_registration !~ '^[0-9]{1,30}$' THEN
     RAISE EXCEPTION 'V263: número de registro obligatorio'; END IF;
   v_record:=gen_random_uuid();
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
     'pending_id',v_pending_id,'record_id',v_record,'flow',evidence.origin,
     'verified',true,'celebration_date',v_date_text,
     'registration_number',v_registration,'decree_id',evidence.decree_id,
     'decree_effect',evidence.decree_effect));
 END LOOP;
 -- The core kernel orders by celebration date + numeric registration number.
 v_result:=sacramentum_ledger.qa_append_batch_v253(
    p_book_id,p_expected_version,p_operation_id,p_expected_folio,
    p_expected_partida,v_items,v_auth);
 FOR v_seat IN SELECT value FROM jsonb_array_elements(v_result->'seats') LOOP
   v_pending_id:=(v_seat->>'pending_id')::uuid;
   SELECT value INTO v_current FROM jsonb_array_elements(v_items)
     WHERE value->>'pending_id'=v_pending_id::text;
   v_record:=(v_current->>'record_id')::uuid;
   EXECUTE format('SELECT to_jsonb(p) FROM public.%I p
    WHERE p.id=$1 AND p.parish_id=$2 FOR UPDATE',v_pending_table)
     INTO v_pending USING v_pending_id,p_parish_id;
   v_raw:=coalesce(v_pending->'raw_data','{}'::jsonb);
   v_book:=v_seat->>'book';
   v_folio:= (v_seat->>'folio')::integer;
   v_partida:= (v_seat->>'number')::integer;
   -- The UNIQUE physical indexes V260 must already be active.
   -- The inserts below populate ORIGINAL sacramental tables, not QA clones.
   IF p_sacrament='bautismo' THEN
     INSERT INTO public.baptisms(
       id,parish_id,book_number,folio,number,numero_registro,status,
       celebration_date,apellidos,nombres,sexo,lugar_bautismo,
       lugar_nacimiento,nombre_padre,nombre_madre,tipo_union_padres,
       padrinos,abuelos_paternos,abuelos_maternos,ministro,da_fe,
       nuip,serial_registro,oficina_registro,direccion,
       fecha_nacimiento,cedula_padre,cedula_madre,fecha_expedicion_registro,
       hora_sacramento,nota_marginal,observations,raw_data)
     VALUES(
       v_record,p_parish_id,v_book,lpad(v_folio::text,4,'0'),
       lpad(v_partida::text,4,'0'),v_current->>'registration_number','seated',
       (v_current->>'celebration_date')::date,
       coalesce(v_raw->>'apellidos',v_raw->>'surname'),
       coalesce(v_raw->>'nombres',v_raw->>'name'),v_raw->>'sexo',
       coalesce(v_raw->>'lugarBautismo',v_raw->>'lugar_bautismo'),
       coalesce(v_raw->>'lugarNacimiento',v_raw->>'lugar_nacimiento'),
       coalesce(v_raw->>'nombrePadre',v_raw->>'nombre_padre'),
       coalesce(v_raw->>'nombreMadre',v_raw->>'nombre_madre'),
       coalesce(v_raw->>'tipoUnionPadres',v_raw->>'tipo_union_padres'),
       v_raw->>'padrinos',
       coalesce(v_raw->>'abuelosPaternos',v_raw->>'abuelos_paternos'),
       coalesce(v_raw->>'abuelosMaternos',v_raw->>'abuelos_maternos'),
       v_raw->>'ministro',coalesce(v_raw->>'daFe',v_raw->>'da_fe'),
       v_raw->>'nuip',coalesce(v_raw->>'serialRegistro',v_raw->>'serial_registro'),
       coalesce(v_raw->>'oficinaRegistro',v_raw->>'oficina_registro'),
       v_raw->>'direccion',
       nullif(coalesce(v_raw->>'fechaNacimiento',v_raw->>'fecha_nacimiento'),'')::date,
       coalesce(v_raw->>'cedulaPadre',v_raw->>'cedula_padre'),
       coalesce(v_raw->>'cedulaMadre',v_raw->>'cedula_madre'),
       nullif(coalesce(v_raw->>'fechaExpedicionRegistro',v_raw->>'fecha_expedicion_registro'),'')::date,
       coalesce(v_raw->>'horaSacramento',v_raw->>'hora_sacramento'),
       coalesce(v_raw->>'notaMarginal',v_raw->>'nota_marginal'),
       coalesce(v_raw->>'observations',v_raw->>'observaciones'),
       v_raw||jsonb_build_object(
        'Libro',v_book,'folio',lpad(v_folio::text,4,'0'),
        'numero',lpad(v_partida::text,4,'0'),'status','seated'));
   ELSIF p_sacrament='confirmacion' THEN
     INSERT INTO public.confirmations(
       id,parish_id,book_number,folio,number,numero_registro,status,
       celebration_date,apellidos,nombres,sexo,lugar_bautismo,
       lugar_nacimiento,nombre_padre,nombre_madre,tipo_union_padres,
       padrinos,ministro,da_fe,nota_marginal,
       fecha_nacimiento,fecha_bautismo,nuip,direccion,cedula_padre,
       cedula_madre,abuelos_paternos,abuelos_maternos,
       hora_sacramento,observations,raw_data)
     VALUES(
       v_record,p_parish_id,v_book,lpad(v_folio::text,4,'0'),
       lpad(v_partida::text,4,'0'),v_current->>'registration_number','seated',
       (v_current->>'celebration_date')::date,v_raw->>'apellidos',
       v_raw->>'nombres',v_raw->>'sexo',
       coalesce(v_raw->>'lugarBautismo',v_raw->>'lugar_bautismo'),
       coalesce(v_raw->>'lugarNacimiento',v_raw->>'lugar_nacimiento'),
       coalesce(v_raw->>'nombrePadre',v_raw->>'nombre_padre'),
       coalesce(v_raw->>'nombreMadre',v_raw->>'nombre_madre'),
       coalesce(v_raw->>'tipoUnionPadres',v_raw->>'tipo_union_padres'),
       v_raw->>'padrinos',v_raw->>'ministro',
       coalesce(v_raw->>'daFe',v_raw->>'da_fe'),
       coalesce(v_raw->>'notaMarginal',v_raw->>'nota_marginal'),
       nullif(coalesce(v_raw->>'fechaNacimiento',v_raw->>'fecha_nacimiento'),'')::date,
       nullif(coalesce(v_raw->>'fechaBautismo',v_raw->>'fecha_bautismo'),'')::date,
       v_raw->>'nuip',v_raw->>'direccion',
       coalesce(v_raw->>'cedulaPadre',v_raw->>'cedula_padre'),
       coalesce(v_raw->>'cedulaMadre',v_raw->>'cedula_madre'),
       coalesce(v_raw->>'abuelosPaternos',v_raw->>'abuelos_paternos'),
       coalesce(v_raw->>'abuelosMaternos',v_raw->>'abuelos_maternos'),
       coalesce(v_raw->>'horaSacramento',v_raw->>'hora_sacramento'),
       coalesce(v_raw->>'observations',v_raw->>'observaciones'),
       v_raw||jsonb_build_object('Libro',v_book,
          'folio',lpad(v_folio::text,4,'0'),
          'numero',lpad(v_partida::text,4,'0'),'status','seated'));
     -- Only real cross-references pointing to this parish can be updated.
     IF nullif(coalesce(v_raw->>'linkedBaptismRecordId',v_raw->>'cross_baptism_id'),'') IS NOT NULL THEN
       BEGIN v_baptism:=coalesce(v_raw->>'linkedBaptismRecordId',v_raw->>'cross_baptism_id')::uuid;
       EXCEPTION WHEN others THEN RAISE EXCEPTION 'V263: referencia bautismal inválida'; END;
       SELECT b.nota_marginal INTO v_baptism_existing FROM public.baptisms b
        WHERE b.id=v_baptism AND b.parish_id=p_parish_id FOR UPDATE;
       IF NOT FOUND THEN RAISE EXCEPTION 'V263: bautismo vinculado no corresponde a esta parroquia'; END IF;
       v_note:=format('Confirmación asentada en Libro %s, Folio %s, Número %s, el %s.',
         v_book,lpad(v_folio::text,4,'0'),lpad(v_partida::text,4,'0'),
         v_current->>'celebration_date');
       UPDATE public.baptisms SET
         nota_marginal=concat_ws(E'\n\n',nullif(v_baptism_existing,''),v_note),
         raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object(
           'lastConfirmationId',v_record,'notaMarginal',
           concat_ws(E'\n\n',nullif(v_baptism_existing,''),v_note)),
         updated_at=clock_timestamp()
       WHERE id=v_baptism AND parish_id=p_parish_id;
       INSERT INTO public.marginal_notes(
         sacrament_type,note_type,content,parish_id,sacrament_id,
         note_date,source_type,source_id,created_by,status)
       VALUES('bautismo','confirmacion',v_note,p_parish_id,v_baptism,
         current_date,'confirmation',v_record,v_auth,'active');
     END IF;
   ELSIF p_sacrament='matrimonio' THEN
     INSERT INTO public.marriages(
       id,parish_id,celebration_date,book_number,folio,number,
       observations,status,raw_data,book_type)
     VALUES(v_record,p_parish_id,(v_current->>'celebration_date')::date,
       v_book,lpad(v_folio::text,4,'0'),lpad(v_partida::text,4,'0'),
       coalesce(v_raw->>'observations',v_raw->>'observaciones'),'seated',
       v_raw||jsonb_build_object('book_type',m.book_type,
         'book_number',v_book,'folio',lpad(v_folio::text,4,'0'),
         'number',lpad(v_partida::text,4,'0'),
         'numero',lpad(v_partida::text,4,'0'),
         'numeroRegistro',v_current->>'registration_number',
         'status','seated'),m.book_type);
   ELSE
     IF nullif(btrim(coalesce(v_raw->>'nombres','')),'') IS NULL OR
       nullif(btrim(coalesce(v_raw->>'apellidos','')),'') IS NULL OR
       nullif(v_raw->>'fecha_defuncion','') IS NULL THEN
       RAISE EXCEPTION 'V263: Exequias requiere identidad y fecha de defunción';
     END IF;
     IF (v_raw->>'fecha_defuncion')::date > (v_current->>'celebration_date')::date THEN
       RAISE EXCEPTION 'V263: las exequias no pueden preceder a la defunción';
     END IF;
     -- V275: the existing Funeral BEFORE/AFTER triggers use the REAL typed
     -- baptism_id. Keep both supported pending-boleta representations,
     -- reject ambiguous references, and let the institution's existing
     -- same-parish/name/date/deceased checks run inside this seat transaction.
     v_baptism:=NULL;
     IF nullif(btrim(coalesce(v_raw->>'baptism_record_id','')),'') IS NOT NULL
        AND nullif(btrim(coalesce(v_raw->>'baptismRecordId','')),'') IS NOT NULL
        AND btrim(v_raw->>'baptism_record_id') IS DISTINCT FROM
            btrim(v_raw->>'baptismRecordId') THEN
        RAISE EXCEPTION 'V275: Exequias tiene referencias bautismales contradictorias';
     END IF;
     IF nullif(btrim(coalesce(v_raw->>'baptism_record_id',
            v_raw->>'baptismRecordId','')),'') IS NOT NULL THEN
       BEGIN
         v_baptism:=btrim(coalesce(nullif(v_raw->>'baptism_record_id',''),
            nullif(v_raw->>'baptismRecordId','')))::uuid;
       EXCEPTION WHEN others THEN
         RAISE EXCEPTION 'V275: referencia bautismal de Exequias inválida';
       END;
     END IF;
     INSERT INTO public.funerals(
       id,parish_id,book_number,folio,number,numero_registro,book_type,status,
       baptism_id,nombres,apellidos,document_id,sexo,fecha_nacimiento,lugar_nacimiento,
       fecha_defuncion,lugar_defuncion,fecha_exequias,hora_exequias,
       lugar_exequias,cementerio,causa_muerte,nombre_padre,nombre_madre,
       conyuge,ministro,da_fe,observations,nota_marginal,raw_data)
     VALUES(v_record,p_parish_id,v_book,lpad(v_folio::text,4,'0'),
       lpad(v_partida::text,4,'0'),v_current->>'registration_number',
       m.book_type,'seated',v_baptism,v_raw->>'nombres',v_raw->>'apellidos',
       v_raw->>'document_id',v_raw->>'sexo',
       nullif(v_raw->>'fecha_nacimiento','')::date,
       v_raw->>'lugar_nacimiento',(v_raw->>'fecha_defuncion')::date,
       v_raw->>'lugar_defuncion',(v_current->>'celebration_date')::date,
       nullif(v_raw->>'hora_exequias','')::time,v_raw->>'lugar_exequias',
       v_raw->>'cementerio',v_raw->>'causa_muerte',
       v_raw->>'nombre_padre',v_raw->>'nombre_madre',v_raw->>'conyuge',
       v_raw->>'ministro',coalesce(v_raw->>'daFe',v_raw->>'da_fe'),
       v_raw->>'observations',v_raw->>'nota_marginal',
       v_raw||jsonb_build_object('baptism_record_id',v_baptism,
         'book_number',v_book,
         'folio',lpad(v_folio::text,4,'0'),
         'number',lpad(v_partida::text,4,'0'),
         'numero_registro',v_current->>'registration_number',
         'book_type',m.book_type,'status','seated'));
   END IF;
   EXECUTE format('UPDATE public.%I SET status=''seated'', reportado=true,
      raw_data=coalesce(raw_data,''{}''::jsonb) ||
        jsonb_build_object(''status'',''seated'',''record_id'',$1,
          ''book_number'',$2,''folio'',$3,''number'',$4)
      WHERE id=$5 AND parish_id=$6 AND status=''pending''
        AND coalesce(reportado,false)=false',v_pending_table)
   USING v_record,v_book,lpad(v_folio::text,4,'0'),
     lpad(v_partida::text,4,'0'),v_pending_id,p_parish_id;
   GET DIAGNOSTICS v_count=ROW_COUNT;
   IF v_count<>1 THEN RAISE EXCEPTION 'V263: boleta modificada concurrentemente'; END IF;
   INSERT INTO public.registry_audit_log(
     actor_user_id,parish_id,diocese_id,entity_type,entity_id,
     action,after_data,metadata)
   VALUES(v_auth,p_parish_id,v_diocese,p_sacrament,v_record,'seat',
      v_raw||jsonb_build_object('book_number',v_book,
        'folio',lpad(v_folio::text,4,'0'),
        'number',lpad(v_partida::text,4,'0')),
      jsonb_build_object('pending_id',v_pending_id,'book_id',p_book_id,
         'operation_id',p_operation_id,
         'seat_id',v_seat->>'seat_id','book_type',m.book_type));
 END LOOP;
 RETURN v_result;
END $fn$;
REVOKE ALL ON FUNCTION sacramentum_ledger.real_seat_v263(
 uuid,text,uuid,bigint,integer,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated;

-- One explicit wrapper for every sacrament; not granted during staging.
-- These are new signatures; cutover must update frontend and revoke old RPCs.
CREATE FUNCTION public.seat_baptism_ledger_v263(
 p_parish_id uuid,p_book_id uuid,p_expected_version bigint,
 p_expected_folio integer,p_expected_partida integer,p_operation_id uuid,
 p_pending_ids jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT sacramentum_ledger.real_seat_v263($1,'bautismo',$2,$3,$4,$5,$6,$7) $$;
CREATE FUNCTION public.seat_confirmation_ledger_v263(
 p_parish_id uuid,p_book_id uuid,p_expected_version bigint,
 p_expected_folio integer,p_expected_partida integer,p_operation_id uuid,
 p_pending_ids jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT sacramentum_ledger.real_seat_v263($1,'confirmacion',$2,$3,$4,$5,$6,$7) $$;
CREATE FUNCTION public.seat_marriage_ledger_v263(
 p_parish_id uuid,p_book_id uuid,p_expected_version bigint,
 p_expected_folio integer,p_expected_partida integer,p_operation_id uuid,
 p_pending_ids jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT sacramentum_ledger.real_seat_v263($1,'matrimonio',$2,$3,$4,$5,$6,$7) $$;
CREATE FUNCTION public.seat_funeral_ledger_v263(
 p_parish_id uuid,p_book_id uuid,p_expected_version bigint,
 p_expected_folio integer,p_expected_partida integer,p_operation_id uuid,
 p_pending_ids jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT sacramentum_ledger.real_seat_v263($1,'exequias',$2,$3,$4,$5,$6,$7) $$;

REVOKE ALL ON FUNCTION public.seat_baptism_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.seat_confirmation_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.seat_marriage_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.seat_funeral_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
COMMIT;
