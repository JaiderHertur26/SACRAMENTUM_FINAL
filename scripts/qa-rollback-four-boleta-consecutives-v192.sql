-- V192 · Cuatro boletas sacramentales consecutivas, dos por sacramento, sin persistencia.
BEGIN;
SET LOCAL statement_timeout='45000ms';
DO $setup$
DECLARE actor uuid;par uuid;
BEGIN
 SELECT up.auth_user_id,up.parish_id INTO STRICT actor,par
 FROM public.user_profiles up
 JOIN public.parishes p ON p.id=up.parish_id AND p.diocese_id=up.diocese_id
 WHERE up.role='parish' AND up.is_active IS TRUE AND upper(up.status)='ACTIVE'
 LIMIT 1;
 PERFORM set_config('qa192.actor',actor::text,true);
 PERFORM set_config('qa192.parish',par::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE kind text;call_sql text;payload jsonb;prev_no bigint;next_text text;first_id uuid;next_id uuid;
 first_no bigint;second_no bigint; kind_count integer:=0;
 p uuid:=current_setting('qa192.parish')::uuid;a uuid:=current_setting('qa192.actor')::uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 FOR kind,call_sql,payload IN SELECT * FROM (VALUES
 ('baptism','SELECT pending_id,numero_registro FROM public.create_pending_baptism($1,$2::jsonb)',
 '{"nombres":"FICTICIO V192","apellidos":"BAUTISMO","fechaSacramento":"2026-10-24","qa_v192":"yes"}'::jsonb),
 ('confirmation','SELECT pending_id,numero_registro FROM public.create_pending_confirmation($1,$2::jsonb)',
 '{"nombres":"FICTICIO V192","apellidos":"CONFIRMACION","fechaSacramento":"2026-10-24","qa_v192":"yes"}'::jsonb),
 ('marriage','SELECT pending_id,numero_registro FROM public.create_pending_marriage($1,$2::jsonb)',
 '{"novioNombres":"FICTICIO","novioApellidos":"V192","noviaNombres":"FICTICIA","noviaApellidos":"V192","fechaSacramento":"2026-10-24","qa_v192":"yes"}'::jsonb),
 ('funeral','SELECT pending_id,numero_registro FROM public.create_pending_funeral($1,$2::jsonb)',
 '{"nombres":"FICTICIO V192","apellidos":"EXEQUIAS","fecha_defuncion":"2026-10-22","fecha_exequias":"2026-10-24","qa_v192":"yes"}'::jsonb)
 ) t(kind,call_sql,payload)
 LOOP
  EXECUTE call_sql INTO first_id,next_text USING p,payload;
  IF first_id IS NULL OR next_text !~ '^[0-9]+$' THEN RAISE EXCEPTION 'V192 invalid first boleta %',kind;END IF;
  first_no=next_text::bigint;
  EXECUTE call_sql INTO next_id,next_text USING p,payload;
  IF next_id IS NULL OR next_id=first_id OR next_text !~ '^[0-9]+$' THEN RAISE EXCEPTION 'V192 invalid second boleta %',kind;END IF;
  second_no=next_text::bigint;
  IF second_no<>first_no+1 THEN RAISE EXCEPTION 'V192 non-monotonic %',kind;END IF;
  kind_count=kind_count+1;
 END LOOP;
 IF kind_count<>4 THEN RAISE EXCEPTION 'V192 incomplete coverage';END IF;
 PERFORM set_config('qa192.boletas',jsonb_build_object('sacraments',kind_count,'boletas',8,
 'strict_consecutives',true,'ids_distinct',true,'all_changes_rolled_back',true)::text,true);
END $qa$;
RESET ROLE;
SELECT current_setting('qa192.boletas')::jsonb AS result;
ROLLBACK;
