-- SACRAMENTUM V105: nulidad matrimonial no debe contaminar partidas bautismales ajenas.
-- Hallazgo reproducido con un Matrimonio y un Bautismo de una tercera persona,
-- ambos ficticios, dentro de BEGIN/ROLLBACK; el sistema añadía nota marginal.
-- El vínculo automático exige comprobar nombre/apellidos de contrayente y
-- libro/folio/número de la partida bautismal presentes en expediente matrimonial.
-- Si faltan estos datos, no se afecta el Bautismo: expediente a conciliación.
CREATE OR REPLACE FUNCTION private.registry_ref_normalized_v105(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path TO ''
AS $fn$
 SELECT CASE WHEN nullif(btrim(p_text),'') IS NULL THEN NULL
  WHEN btrim(p_text) ~ '^[0-9]+$'
    THEN coalesce(nullif(ltrim(btrim(p_text),'0'),''),'0')
  ELSE upper(btrim(p_text))
 END
$fn$;

CREATE OR REPLACE FUNCTION private.person_name_normalized_v105(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path TO ''
AS $fn$
 SELECT nullif(
   regexp_replace(
     translate(lower(btrim(coalesce(p_text,''))), 'áéíóúü', 'aeiouu'),
     '[[:space:]]+', ' ', 'g'
   ),''
 )
$fn$;

CREATE OR REPLACE FUNCTION private.assert_nullity_baptism_link_v105(
 p_marriage_id uuid, p_baptism_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $fn$
DECLARE
 v_marriage public.marriages%rowtype;
 v_baptism public.baptisms%rowtype;
 v_party text;
 v_first text;
 v_last text;
 v_book text;
 v_folio text;
 v_number text;
 v_verified boolean:=false;
BEGIN
 SELECT * INTO v_marriage FROM public.marriages WHERE id=p_marriage_id;
 SELECT * INTO v_baptism FROM public.baptisms WHERE id=p_baptism_id;
 IF v_marriage.id IS NULL OR v_baptism.id IS NULL THEN
  RAISE EXCEPTION 'No fue posible verificar el matrimonio y la partida bautismal.'
   USING ERRCODE='23514';
 END IF;

 FOREACH v_party IN ARRAY ARRAY['novio','novia'] LOOP
  v_first := nullif(btrim(v_marriage.raw_data->>(v_party||'Nombres')),'');
  v_last := nullif(btrim(v_marriage.raw_data->>(v_party||'Apellidos')),'');
  v_book := nullif(btrim(v_marriage.raw_data->>(v_party||'BautismoLibro')),'');
  v_folio := nullif(btrim(v_marriage.raw_data->>(v_party||'BautismoFolio')),'');
  v_number := nullif(btrim(v_marriage.raw_data->>(v_party||'BautismoNumero')),'');

  IF v_first IS NOT NULL AND v_last IS NOT NULL
   AND v_book IS NOT NULL AND v_folio IS NOT NULL AND v_number IS NOT NULL
   AND private.person_name_normalized_v105(v_first)=private.person_name_normalized_v105(v_baptism.nombres)
   AND private.person_name_normalized_v105(v_last)=private.person_name_normalized_v105(v_baptism.apellidos)
   AND private.registry_ref_normalized_v105(v_book)=private.registry_ref_normalized_v105(v_baptism.book_number)
   AND private.registry_ref_normalized_v105(v_folio)=private.registry_ref_normalized_v105(v_baptism.folio)
   AND private.registry_ref_normalized_v105(v_number)=private.registry_ref_normalized_v105(v_baptism.number)
  THEN
   v_verified:=true;
   EXIT;
  END IF;
 END LOOP;

 IF NOT v_verified THEN
  RAISE EXCEPTION 'Partida bautismal sin vínculo verificable con los contrayentes: coteje nombre, apellidos, libro, folio y número antes de propagar la nulidad.'
    USING ERRCODE='23514';
 END IF;
END;
$fn$;

-- Los helpers se llaman internamente desde la RPC con propietario postgres.
REVOKE EXECUTE ON FUNCTION private.registry_ref_normalized_v105(text)
 FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION private.person_name_normalized_v105(text)
 FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION private.assert_nullity_baptism_link_v105(uuid,uuid)
 FROM PUBLIC,anon,authenticated;

DO $patch$
DECLARE
 v_src text;
 v_loop text := '  if p_baptism_ids is not null then';
 v_loop_new text := $txt$
  if p_baptism_ids is not null then
    if cardinality(p_baptism_ids)>2
       or (select count(distinct t.id) from unnest(p_baptism_ids) as t(id))
          <> cardinality(p_baptism_ids) then
      raise exception 'La nulidad admite como máximo las dos partidas bautismales verificadas, sin duplicados ni valores vacíos';
    end if;$txt$;
 v_branch text := '      if v_baptism_parish=v_marriage.parish_id then';
 v_branch_new text :=
  E'      perform private.assert_nullity_baptism_link_v105(p_marriage_id,v_baptism_id);\n\n'
  ||v_branch;
BEGIN
 SELECT pg_get_functiondef(
  'public.apply_marriage_nullity(uuid,text,date,text,jsonb,uuid[])'::regprocedure
 ) INTO v_src;
 v_src:=replace(v_src,E'\r\n',E'\n');
 IF strpos(v_src,v_loop)=0 OR strpos(v_src,v_branch)=0
    OR strpos(v_src,'private.assert_nullity_baptism_link_v105')>0 THEN
  RAISE EXCEPTION 'La función de nulidad no coincide con la versión auditada: no se modifica.';
 END IF;
 v_src:=replace(replace(v_src,v_loop,v_loop_new),v_branch,v_branch_new);
 EXECUTE v_src;
END$patch$;
