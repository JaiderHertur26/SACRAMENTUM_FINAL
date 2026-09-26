-- SACRAMENTUM V62 · Puente canónico de normalización DBF -> modelo moderno.
-- El Archivo Maestro permanece inmutable; sólo se rehidratan los lotes derivados V60.

create or replace function public.legacy_boolish_v62(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(trim(coalesce(p_value,''))) in ('true','1','si','sí','yes','t');
$$;

create or replace function public.legacy_sex_v62(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(trim(coalesce(p_value,''))) in ('1','M','MASCULINO') then 'MASCULINO'
    when upper(trim(coalesce(p_value,''))) in ('2','F','FEMENINO') then 'FEMENINO'
    else nullif(upper(trim(coalesce(p_value,''))),'')
  end;
$$;

create or replace function public.legacy_union_type_v62(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case trim(coalesce(p_value,''))
    when '1' then 'MATRIMONIO CATÓLICO'
    when '2' then 'MATRIMONIO CIVIL'
    when '3' then 'UNIÓN LIBRE'
    when '4' then 'MADRE SOLTERA'
    when '5' then 'OTRO CASO'
    else nullif(upper(trim(coalesce(p_value,''))),'')
  end;
$$;
create or replace function public.normalize_legacy_archive_record_v62(
  p_profile_key text,
  p_raw jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text := upper(trim(coalesce(p_profile_key,'')));
  r jsonb := coalesce(p_raw,'{}'::jsonb);
  code text;
  sacrament text;
  descr text;
begin
  if k='BAUTIZOS' then
    return jsonb_build_object(
      'book_number',trim(coalesce(r->>'libro','')),
      'folio',trim(coalesce(r->>'folio','')),
      'number',trim(coalesce(r->>'numero','')),
      'celebration_date',nullif(split_part(coalesce(r->>'fecbau',''),'T',1),''),
      'celebration_place',trim(coalesce(r->>'lugbau','')),
      'last_names',trim(coalesce(r->>'apellidos','')),
      'names',trim(coalesce(r->>'nombres','')),
      'birth_date',nullif(split_part(coalesce(r->>'fecnac',''),'T',1),''),
      'birth_place',trim(coalesce(nullif(r->>'lugarn',''),r->>'lugnac','')),
      'gender',public.legacy_sex_v62(r->>'sexo'),
      'parent_union_type',public.legacy_union_type_v62(r->>'tipohijo'),
      'father_name',trim(coalesce(r->>'padre','')),
      'father_document',trim(coalesce(r->>'cedupad','')),
      'mother_name',trim(coalesce(r->>'madre','')),
      'mother_document',trim(coalesce(r->>'cedumad','')),
      'paternal_grandparents',trim(coalesce(r->>'abuepat','')),
      'maternal_grandparents',trim(coalesce(r->>'abuemat','')),
      'godparents',trim(coalesce(r->>'padrinos','')),
      'address',trim(coalesce(r->>'direccion','')),
      'minister',trim(coalesce(r->>'ministro','')),
      'legacy_dafe_code',trim(coalesce(r->>'dafe','')),
      'civil_registry_number',trim(coalesce(nullif(r->>'regciv',''),r->>'numinsc','')),
      'nuip',trim(coalesce(r->>'nuip','')),
      'civil_registry_office',trim(coalesce(r->>'notaria','')),
      'civil_registry_date',nullif(split_part(coalesce(r->>'fecregis',''),'T',1),''),
      'annulled',public.legacy_boolish_v62(r->>'anulado'),
      'observations',trim(coalesce(nullif(r->>'observacio',''),r->>'observations','')),
      'legacy_updated_at',r->>'actualizad',
      'legacy_flags',jsonb_build_object(
        'adulto',r->'adulto','confirmacion',r->'confirmaci',
        'docu1',r->'docu1','docu2',r->'docu2','docu3',r->'docu3','docu4',r->'docu4'
      )
    );
  end if;
  if k='CONFIRMA' then
    return jsonb_build_object(
      'book_number',trim(coalesce(r->>'libro','')),
      'folio',trim(coalesce(r->>'folio','')),
      'number',trim(coalesce(r->>'numero','')),
      'celebration_date',nullif(split_part(coalesce(r->>'feccon',''),'T',1),''),
      'celebration_place',trim(coalesce(r->>'lugcon','')),
      'last_names',trim(coalesce(r->>'apellidos','')),
      'names',trim(coalesce(r->>'nombres','')),
      'birth_date',nullif(split_part(coalesce(r->>'fecnac',''),'T',1),''),
      'age_text',trim(coalesce(r->>'edad','')),
      'gender',public.legacy_sex_v62(r->>'sexo'),
      'father_name',trim(coalesce(r->>'padre','')),
      'mother_name',trim(coalesce(r->>'madre','')),
      'sponsor',trim(coalesce(nullif(r->>'padri',''),r->>'padrinos','')),
      'minister',trim(coalesce(r->>'ministro','')),
      'legacy_dafe_code',trim(coalesce(r->>'dafe','')),
      'baptism_church_code',trim(coalesce(r->>'codbau','')),
      'baptism_place',trim(coalesce(r->>'lugbau','')),
      'baptism_book',trim(coalesce(r->>'libbau','')),
      'baptism_folio',trim(coalesce(r->>'folbau','')),
      'baptism_number',trim(coalesce(r->>'numbau','')),
      'annulled',public.legacy_boolish_v62(r->>'anulado'),
      'legacy_updated_at',r->>'actualizad',
      'observations',trim(coalesce(nullif(r->>'observacio',''),r->>'observations',''))
    );
  end if;

  if k='MATRIMON' then
    return jsonb_build_object(
      'book_number',trim(coalesce(r->>'libro','')),
      'folio',trim(coalesce(r->>'folio','')),
      'number',trim(coalesce(r->>'numero','')),
      'legacy_entry_number',trim(coalesce(r->>'numinsc','')),
      'celebration_date',nullif(split_part(coalesce(r->>'fecmat',''),'T',1),''),
      'party_1',jsonb_build_object(
        'last_names',trim(coalesce(r->>'apell1','')),
        'names',trim(coalesce(r->>'nombr1','')),
        'parents',trim(coalesce(r->>'hijode','')),
        'gender',public.legacy_sex_v62(coalesce(r->>'sexo1',r->>'sex1',r->>'sexo_1')),
        'baptism_place',trim(coalesce(r->>'lugbau1','')),
        'baptism_date',nullif(split_part(coalesce(r->>'fecbau1',''),'T',1),''),
        'baptism_book',trim(coalesce(r->>'libbau1','')),
        'baptism_folio',trim(coalesce(r->>'folbau1','')),
        'baptism_number',trim(coalesce(r->>'numbau1','')),
        'birth_date',nullif(split_part(coalesce(r->>'fecnac1',''),'T',1),''),
        'birth_place',trim(coalesce(r->>'lugnac1',''))
      ),
      'party_2',jsonb_build_object(
        'last_names',trim(coalesce(r->>'apell2','')),
        'names',trim(coalesce(r->>'nombr2','')),
        'parents',trim(coalesce(r->>'hijade','')),
        'gender',public.legacy_sex_v62(coalesce(r->>'sexo2',r->>'sex2',r->>'sexo_2')),
        'baptism_place',trim(coalesce(r->>'lugbau2','')),
        'baptism_date',nullif(split_part(coalesce(r->>'fecbau2',''),'T',1),''),
        'baptism_book',trim(coalesce(r->>'libbau2','')),
        'baptism_folio',trim(coalesce(r->>'folbau2','')),
        'baptism_number',trim(coalesce(r->>'numbau2','')),
        'birth_date',nullif(split_part(coalesce(r->>'fecnac2',''),'T',1),''),
        'birth_place',trim(coalesce(r->>'lugnac2',''))
      ),
      'witnesses',trim(coalesce(r->>'testigos','')),
      'minister',trim(coalesce(r->>'ministro','')),
      'legacy_dafe_code',trim(coalesce(r->>'dafe','')),
      'free_union',r->'unilibre',
      'annulled',public.legacy_boolish_v62(r->>'anulado'),
      'legacy_updated_at',r->>'actualizad',
      'observations',trim(coalesce(nullif(r->>'observacio',''),r->>'observations',''))
    );
  end if;
  if k='DIFUNTOS' then
    return jsonb_build_object(
      'book_number',trim(coalesce(r->>'libro','')),
      'folio',trim(coalesce(r->>'folio','')),
      'number',trim(coalesce(r->>'numero','')),
      'names',trim(coalesce(nullif(r->>'nombres',''),r->>'nombre','')),
      'last_names',trim(coalesce(r->>'apellidos','')),
      'gender',public.legacy_sex_v62(coalesce(r->>'sexo',r->>'sex')),
      'birth_date',nullif(split_part(coalesce(r->>'fecnac',''),'T',1),''),
      'birth_place',trim(coalesce(nullif(r->>'lugnac',''),nullif(r->>'lugarn',''),r->>'lugar_nacimiento','')),
      'death_date',nullif(split_part(coalesce(nullif(r->>'fecham',''),r->>'fecha_defuncion',''),'T',1),''),
      'death_place',trim(coalesce(nullif(r->>'lugmue',''),r->>'lugar_defuncion','')),
      'funeral_date',nullif(split_part(coalesce(nullif(r->>'fechae',''),r->>'fecha_exequias',''),'T',1),''),
      'funeral_place',trim(coalesce(nullif(r->>'lugexe',''),r->>'lugar_exequias','')),
      'cemetery',trim(coalesce(r->>'cementerio','')),
      'father_name',trim(coalesce(r->>'padre','')),
      'mother_name',trim(coalesce(r->>'madre','')),
      'spouse',trim(coalesce(r->>'conyuge','')),
      'minister',trim(coalesce(r->>'ministro','')),
      'legacy_dafe_code',trim(coalesce(r->>'dafe','')),
      'observations',trim(coalesce(nullif(r->>'observacio',''),r->>'observations',''))
    );
  end if;

  if k='INSBAUTI' then
    return jsonb_build_object(
      'legacy_entry_number',trim(coalesce(r->>'numero','')),
      'inscription_date',nullif(split_part(coalesce(r->>'fecins',''),'T',1),''),
      'celebration_date',nullif(split_part(coalesce(r->>'fecbau',''),'T',1),''),
      'celebration_place',trim(coalesce(r->>'lugbau','')),
      'last_names',trim(coalesce(r->>'apellidos','')),
      'names',trim(coalesce(r->>'nombres','')),
      'birth_date',nullif(split_part(coalesce(r->>'fecnac',''),'T',1),''),
      'birth_place',trim(coalesce(nullif(r->>'lugarn',''),r->>'lugnac','')),
      'gender',public.legacy_sex_v62(r->>'sexo'),
      'parent_union_type',public.legacy_union_type_v62(r->>'tipohijo'),
      'father_name',trim(coalesce(r->>'padre','')),
      'father_document',trim(coalesce(r->>'cedupad','')),
      'mother_name',trim(coalesce(r->>'madre','')),
      'mother_document',trim(coalesce(r->>'cedumad','')),
      'paternal_grandparents',trim(coalesce(r->>'abuepat','')),
      'maternal_grandparents',trim(coalesce(r->>'abuemat','')),
      'godparents',trim(coalesce(r->>'padrinos','')),
      'minister',trim(coalesce(r->>'ministro','')),
      'decree_number',trim(coalesce(r->>'numdecreto','')),
      'decree_date',nullif(split_part(coalesce(r->>'fecdecreto',''),'T',1),''),
      'decree_issuer',trim(coalesce(r->>'expdecreto','')),
      'civil_registry_number',trim(coalesce(r->>'regciv','')),
      'nuip',trim(coalesce(r->>'nuip','')),
      'civil_registry_office',trim(coalesce(r->>'notaria','')),
      'civil_registry_date',nullif(split_part(coalesce(r->>'fecregis',''),'T',1),''),
      'reported',public.legacy_boolish_v62(r->>'reported')
    );
  end if;
  if k='INSCONFI' then
    return jsonb_build_object(
      'legacy_entry_number',trim(coalesce(r->>'numero','')),
      'inscription_date',nullif(split_part(coalesce(r->>'fecins',''),'T',1),''),
      'celebration_date',nullif(split_part(coalesce(r->>'feccon',''),'T',1),''),
      'celebration_place',trim(coalesce(r->>'lugcon','')),
      'last_names',trim(coalesce(r->>'apellidos','')),
      'names',trim(coalesce(r->>'nombres','')),
      'birth_date',nullif(split_part(coalesce(r->>'fecnac',''),'T',1),''),
      'age_text',trim(coalesce(r->>'edad','')),
      'gender',public.legacy_sex_v62(r->>'sexo'),
      'baptism_church_code',trim(coalesce(r->>'codbau','')),
      'baptism_place',trim(coalesce(r->>'lugbau','')),
      'baptism_book',trim(coalesce(r->>'libbau','')),
      'baptism_folio',trim(coalesce(r->>'folbau','')),
      'baptism_number',trim(coalesce(r->>'numbau','')),
      'father_name',trim(coalesce(r->>'padre','')),
      'mother_name',trim(coalesce(r->>'madre','')),
      'sponsor',trim(coalesce(r->>'padri','')),
      'minister',trim(coalesce(r->>'ministro','')),
      'reported',public.legacy_boolish_v62(r->>'reported')
    );
  end if;

  if k='INSMATRI' then
    return r || jsonb_build_object('reported',public.legacy_boolish_v62(r->>'reported'));
  end if;

  if k in ('NTBAU001','NTBAU002','NTCON001','NTDEF001','NTMAT001','NTMAT002') then
    return jsonb_build_object(
      'book_number',trim(coalesce(r->>'libro','')),
      'folio',trim(coalesce(r->>'folio','')),
      'number',trim(coalesce(r->>'numero','')),
      'content',trim(coalesce(r->>'nota','')),
      'legacy_dafe_code',trim(coalesce(r->>'dafe','')),
      'legacy_updated_at',r->>'actualizad',
      'sacrament_type',case
        when k like 'NTBAU%' then 'bautismo'
        when k like 'NTCON%' then 'confirmacion'
        when k like 'NTDEF%' then 'exequias'
        else 'matrimonio'
      end,
      'classification',case
        when k like 'NTMAT%' and upper(coalesce(r->>'nota','')) like '%NIHIL OBSTAT%' then 'nihil_obstat'
        when k like 'NTMAT%' and (
          upper(coalesce(r->>'nota','')) like '%DISPARIDAD DE CULTO%'
          or upper(coalesce(r->>'nota','')) like '%MIXTA RELIGION%'
        ) then 'disparidad_mixta'
        when k like 'NTMAT%' and (
          upper(coalesce(r->>'nota','')) like '%DECLARADO NULO%'
          or upper(coalesce(r->>'nota','')) like '%DECLARATORIA DE NULIDAD%'
          or upper(coalesce(r->>'nota','')) like '%SE ANULA ESTA PARTIDA%'
          or upper(coalesce(r->>'nota','')) like '%ANULACION DEL MATRIMONIO%'
        ) then 'nulidad_referida'
        when k like 'NTMAT%' then 'otra'
        else 'historical_note'
      end
    );
  end if;
  if k='ANULACION' then
    code:=trim(coalesce(r->>'codiconcep',''));
    sacrament:=case when code='003' then 'matrimonio' when code='004' then 'confirmacion' else 'bautismo' end;
    return jsonb_build_object(
      'original_book',trim(coalesce(r->>'libro','')),
      'original_folio',trim(coalesce(r->>'folio','')),
      'original_number',trim(coalesce(r->>'numero','')),
      'decree_number',trim(coalesce(r->>'decreto','')),
      'concept_code',code,
      'decree_date',nullif(split_part(coalesce(r->>'fecha',''),'T',1),''),
      'new_book',trim(coalesce(r->>'newlib','')),
      'new_folio',trim(coalesce(r->>'newfol','')),
      'new_number',trim(coalesce(r->>'newnum','')),
      'observations',trim(coalesce(r->>'observacio','')),
      'legacy_dafe_code',trim(coalesce(r->>'dafe','')),
      'type',r->'tipo',
      'legacy_created_at',coalesce(r->>'fechanul',r->>'actualizad'),
      'legacy_user',trim(coalesce(r->>'usuario','')),
      'sacrament_type',sacrament
    );
  end if;

  if k='CPTOANULA' then
    descr:=upper(trim(coalesce(r->>'concepto','')));
    return jsonb_build_object(
      'code',trim(coalesce(r->>'codigo','')),
      'concept',trim(coalesce(r->>'concepto','')),
      'registers',public.legacy_boolish_v62(r->>'seinscribe'),
      'generates_note',public.legacy_boolish_v62(r->>'gennota'),
      'generates_document',public.legacy_boolish_v62(r->>'gendocum'),
      'book_mode',coalesce(nullif(r->>'enlibro',''),'0')::integer,
      'issuer',trim(coalesce(r->>'expide','')),
      'type',case when descr like '%MATRIMON%' then 'matrimonio'
                  when descr like '%CONFIR%' then 'confirmacion'
                  when descr like '%BAUT%' then 'bautismo' else 'general' end
    );
  end if;
  if k='CERTIFICADOS' then
    code:=regexp_replace(trim(coalesce(r->>'codigo','')),'\.0$','');
    descr:=upper(trim(coalesce(r->>'descripcio','')));
    return jsonb_build_object(
      'legacy_code',code,
      'code','LEGACY-'||code,
      'name',trim(coalesce(r->>'descripcio','')),
      'category',case
        when descr like '%DISPENSA%' then 'dispensation'
        when descr like '%SOLICITUD%' then 'request'
        when descr like '%CORRECCI%' then 'correction_request'
        when descr like '%REPOSICI%' then 'replacement_request'
        when descr like '%CERTIFIC%' then 'certificate'
        when descr like '%PERMISO%' or descr like '%LICENCIA%' then 'permission'
        else 'legacy_document' end,
      'template_text',coalesce(r->>'plantilla','')
    );
  end if;

  if k='CIUDADES' then
    return jsonb_build_object(
      'source',trim(coalesce(r->>'source','')),
      'value',trim(coalesce(nullif(r->>'data',''),r->>'nombre','')),
      'usage_count',coalesce(nullif(r->>'count',''),'0')::integer,
      'weight',coalesce(nullif(r->>'weight',''),'0')::integer,
      'source_created_at',r->>'created',
      'source_updated_at',r->>'updated',
      'source_user',trim(coalesce(r->>'user',''))
    );
  end if;

  if k='DIOCESIS' then
    return jsonb_build_object(
      'legacy_code',trim(coalesce(r->>'codigo','')),
      'name',trim(coalesce(r->>'nombre','')),
      'nit',trim(coalesce(r->>'nronit','')),
      'address',trim(coalesce(r->>'direccion','')),
      'phone',trim(coalesce(r->>'telefono','')),
      'fax',trim(coalesce(r->>'nrofax','')),
      'email',trim(coalesce(r->>'email','')),
      'city',trim(coalesce(r->>'ciudad','')),
      'bishop_1',trim(coalesce(r->>'obispo_1','')),
      'bishop_2',trim(coalesce(r->>'obispo_2',''))
    );
  end if;

  if k='IGLESIAS' then
    return jsonb_build_object(
      'legacy_code',trim(coalesce(r->>'codigo','')),
      'name',trim(coalesce(r->>'nombre','')),
      'nit',trim(coalesce(r->>'nronit','')),
      'address',trim(coalesce(r->>'direccion','')),
      'city',trim(coalesce(r->>'ciudad','')),
      'phone',trim(coalesce(r->>'telefono','')),
      'fax',trim(coalesce(r->>'nrofax','')),
      'email',trim(coalesce(r->>'email','')),
      'priest_name',trim(coalesce(r->>'parroco','')),
      'diocese_legacy_code',trim(coalesce(r->>'diocesis',''))
    );
  end if;
  if k='PARROCOS' then
    return jsonb_build_object(
      'legacy_code',trim(coalesce(r->>'codigo','')),
      'priest_name',trim(coalesce(r->>'nombre','')),
      'priest_given_names',trim(coalesce(r->>'nombre','')),
      'priest_surnames','',
      'priest_honorific','',
      'name_split_confidence','review',
      'service_start',nullif(split_part(coalesce(r->>'fecing',''),'T',1),''),
      'service_end',nullif(split_part(coalesce(r->>'fecsal',''),'T',1),''),
      'legacy_state',r->'estado',
      'legacy_grade',trim(coalesce(r->>'grado',''))
    );
  end if;

  -- OBISPOS, MISDATOS, PARAMETROS, INSCOMUN y perfiles sólo-archivo
  -- se preservan literalmente.
  return r;
end;
$$;
create or replace function public.repair_canonical_legacy_batches_v62(
  p_source_installation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_diocese uuid;
  v_source public.legacy_source_installations%rowtype;
  v_rows integer := 0;
  v_recovered integer := 0;
  v_batches integer := 0;
begin
  if auth.uid() is null then raise exception 'Sesión no autenticada'; end if;
  v_role:=public.current_app_role();
  v_diocese:=public.current_app_diocese_id();

  select * into v_source
  from public.legacy_source_installations
  where id=p_source_installation_id;

  if v_source.id is null then raise exception 'Instalación legacy no encontrada'; end if;
  if v_role not in ('diocese','admin_general') then raise exception 'No autorizado'; end if;
  if v_role='diocese' and v_source.owner_diocese_id is distinct from v_diocese then
    raise exception 'La instalación pertenece a otra jurisdicción';
  end if;

  with repaired as (
    update public.legacy_import_rows r
    set
      target_entity=p.target_entity,
      normalized_data=public.normalize_legacy_archive_record_v62(b.profile_key,r.original_data),
      status=case
        when r.status='error'
         and coalesce(r.issue_details->>'import_error','')='Entidad de importación no soportada: <NULL>'
        then 'valid'
        else r.status
      end,
      issue_codes=case
        when coalesce(r.issue_details->>'import_error','')='Entidad de importación no soportada: <NULL>'
        then array_remove(coalesce(r.issue_codes,'{}'::text[]),'IMPORT_ERROR')
        else r.issue_codes
      end,
      issue_details=(case
        when coalesce(r.issue_details->>'import_error','')='Entidad de importación no soportada: <NULL>'
        then coalesce(r.issue_details,'{}'::jsonb)-'import_error'
        else coalesce(r.issue_details,'{}'::jsonb)
      end) || jsonb_build_object(
        'canonical_normalization_v62',true,
        'canonical_target_entity',p.target_entity
      ),
      updated_at=now()
    from public.legacy_import_batches b
    join public.legacy_import_profiles p on p.profile_key=b.profile_key
    where r.batch_id=b.id
      and b.metadata->>'source_installation_id'=p_source_installation_id::text
      and b.metadata->>'canonical_archive_v60'='true'
    returning r.id,
      (r.status='valid') recovered
  )
  select count(*),count(*) filter(where recovered)
    into v_rows,v_recovered
  from repaired;

  -- Reproduce las cuarentenas documentales del Centro de Migración.
  update public.legacy_import_rows r
  set
    status='review',
    issue_codes=array_append(
      array_remove(coalesce(r.issue_codes,'{}'::text[]),'CANONICAL_REVIEW_V62'),
      'CANONICAL_REVIEW_V62'
    ),
    issue_details=coalesce(r.issue_details,'{}'::jsonb)||jsonb_build_object(
      'canonical_review_v62',
      case
        when b.profile_key='MATRIMON' and nullif(trim(r.normalized_data->>'book_number'),'') is null
          then 'Matrimonio histórico sin Libro; requiere revisión física'
        when b.profile_key in ('BAUTIZOS','CONFIRMA','MATRIMON','DIFUNTOS')
             and nullif(trim(r.normalized_data->>'folio'),'') is null
          then 'Falta Folio'
        when b.profile_key in ('BAUTIZOS','CONFIRMA','MATRIMON','DIFUNTOS')
             and nullif(trim(r.normalized_data->>'number'),'') is null
          then 'Falta Número'
        when b.profile_key in ('BAUTIZOS','CONFIRMA','DIFUNTOS')
             and nullif(trim(r.normalized_data->>'book_number'),'') is null
          then 'Falta Libro'
        when b.profile_key='CONFIRMA'
             and nullif(trim(r.normalized_data->>'celebration_date'),'') is null
          then 'Fecha de Confirmación obligatoria'
        when b.profile_key='MATRIMON'
             and nullif(trim(r.normalized_data->>'celebration_date'),'') is null
          then 'Fecha de Matrimonio obligatoria'
        else 'Registro canónico requiere revisión'
      end
    ),
    updated_at=now()
  from public.legacy_import_batches b
  where r.batch_id=b.id
    and b.metadata->>'source_installation_id'=p_source_installation_id::text
    and b.metadata->>'canonical_archive_v60'='true'
    and r.status='valid'
    and (
      (b.profile_key='MATRIMON' and nullif(trim(r.normalized_data->>'book_number'),'') is null)
      or (
        b.profile_key in ('BAUTIZOS','CONFIRMA','MATRIMON','DIFUNTOS')
        and (
          nullif(trim(r.normalized_data->>'folio'),'') is null
          or nullif(trim(r.normalized_data->>'number'),'') is null
        )
      )
      or (
        b.profile_key in ('BAUTIZOS','CONFIRMA','DIFUNTOS')
        and nullif(trim(r.normalized_data->>'book_number'),'') is null
      )
      or (
        b.profile_key='CONFIRMA'
        and nullif(trim(r.normalized_data->>'celebration_date'),'') is null
      )
      or (
        b.profile_key='MATRIMON'
        and nullif(trim(r.normalized_data->>'celebration_date'),'') is null
      )
    );

  update public.legacy_import_batches b
  set
    valid_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status='valid'),
    review_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status='review'),
    error_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status='error'),
    skipped_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status in ('skipped','duplicate')),
    imported_count=(select count(*) from public.legacy_import_rows r where r.batch_id=b.id and r.status='imported'),
    status=case
      when exists(select 1 from public.legacy_import_rows r where r.batch_id=b.id and r.status='valid') then 'ready'
      when exists(select 1 from public.legacy_import_rows r where r.batch_id=b.id and r.status in ('review','error')) then 'completed_with_review'
      else 'completed'
    end,
    metadata=coalesce(b.metadata,'{}'::jsonb)||jsonb_build_object(
      'canonical_normalized_v62',true,
      'canonical_normalized_at',now()
    ),
    updated_at=now()
  where b.metadata->>'source_installation_id'=p_source_installation_id::text
    and b.metadata->>'canonical_archive_v60'='true';

  get diagnostics v_batches=row_count;

  insert into public.registry_audit_log(
    actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata
  ) values (
    auth.uid(),v_source.mapped_parish_id,v_source.owner_diocese_id,
    'legacy_source_installation',v_source.id,
    'canonical_legacy_normalization_v62',
    jsonb_build_object('rows_normalized',v_rows,'rows_recovered',v_recovered,'batches',v_batches),
    jsonb_build_object('source_installation_id',v_source.id)
  );

  return jsonb_build_object(
    'installation_id',v_source.id,
    'rows_normalized',v_rows,
    'rows_recovered',v_recovered,
    'batches_updated',v_batches
  );
end;
$$;
revoke all on function public.legacy_boolish_v62(text) from public,anon,authenticated;
revoke all on function public.legacy_sex_v62(text) from public,anon,authenticated;
revoke all on function public.legacy_union_type_v62(text) from public,anon,authenticated;
revoke all on function public.normalize_legacy_archive_record_v62(text,jsonb) from public,anon,authenticated;

revoke all on function public.repair_canonical_legacy_batches_v62(uuid) from public;
revoke all on function public.repair_canonical_legacy_batches_v62(uuid) from anon;
grant execute on function public.repair_canonical_legacy_batches_v62(uuid) to authenticated;

comment on function public.repair_canonical_legacy_batches_v62(uuid)
is 'Rehidrata lotes V60 desde DBF original usando las mismas reglas semánticas del Centro de Migración, sin alterar el Archivo Histórico Maestro.';
