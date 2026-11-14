-- El ensayo cambia de identidad en una base PostgreSQL desechable.
BEGIN;
DO $test$
DECLARE
  file jsonb;
  other_file jsonb;
  copy jsonb;
  rows jsonb;
  copy_id uuid;
  before_digest text;
  active_count integer;
  n integer;
BEGIN
  IF has_function_privilege('anon','public.personal_backup_v329(text,jsonb,text,integer,uuid)','EXECUTE')
    OR has_table_privilege('authenticated','sacramentum_private.personal_backup_key_v329','SELECT')
    OR has_table_privilege('authenticated','sacramentum_private.personal_backup_imports_v329','SELECT,INSERT,UPDATE,DELETE')
    OR has_function_privilege('authenticated','sacramentum_private.backup_sections_v329(public.user_profiles)','EXECUTE') THEN
    RAISE EXCEPTION 'Se concedió acceso directo fuera de la RPC autenticada';
  END IF;
  SELECT md5(jsonb_agg(to_jsonb(b) ORDER BY b.id)::text) INTO before_digest FROM public.baptisms b;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub',fixture_backup_id(1)::text,true);
  IF (personal_backup_v329('status')->'copy') IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'La exportación no debe requerir una importación previa';
  END IF;
  file:=personal_backup_v329('export');
  IF file->>'format' IS DISTINCT FROM 'SACRAMENTUM_PERSONAL_BACKUP' OR length(file->>'integrity')<>64
    OR file ? 'sections' OR file::text LIKE '%Persona ficticia%' THEN
    RAISE EXCEPTION 'El archivo contiene datos en claro o un formato inválido';
  END IF;
  copy:=personal_backup_v329('import',file);
  copy_id:=(copy->>'id')::uuid;
  IF copy->'sections'->>'bautismos' IS DISTINCT FROM '27'
    OR copy->'sections'->>'decretos' IS DISTINCT FROM '1'
    OR copy->'sections'->>'exequias' IS DISTINCT FROM '1'
    OR copy->'sections'->>'expedientes' IS DISTINCT FROM '1'
    OR copy->'sections'->>'notas_marginales' IS DISTINCT FROM '1'
    OR copy->'sections' ? 'informes'
    OR personal_backup_v329('import',file) IS DISTINCT FROM copy THEN
    RAISE EXCEPTION 'La copia parroquial salió de ámbito o la reimportación cambió su identidad';
  END IF;
  rows:=personal_backup_v329('section',null,'bautismos',0,copy_id);
  IF jsonb_array_length(rows->'rows')<>25 OR rows->>'total' IS DISTINCT FROM '27'
    OR rows->'rows'->0->>'nombres' IS DISTINCT FROM 'Persona ficticia 1'
    OR jsonb_array_length(personal_backup_v329('section',null,'bautismos',25,copy_id)->'rows')<>2 THEN
    RAISE EXCEPTION 'Falló la paginación de la consulta';
  END IF;
  BEGIN
    PERFORM personal_backup_v329('import',jsonb_set(file,'{integrity}',to_jsonb(repeat('0',64))));
    RAISE EXCEPTION 'Se aceptó una copia alterada';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM personal_backup_v329('import',jsonb_set(file,'{exportedAt}','"2001-01-01"'));
    RAISE EXCEPTION 'Se aceptaron metadatos alterados';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub',fixture_backup_id(2)::text,true);
  BEGIN
    PERFORM personal_backup_v329('import',file);
    RAISE EXCEPTION 'Otra cuenta de la misma parroquia pudo importar la copia';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  IF personal_backup_v329('status')->'copy' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'Otra cuenta pudo ver la copia importada';
  END IF;
  other_file:=personal_backup_v329('export');
  PERFORM personal_backup_v329('import',other_file);

  PERFORM set_config('request.jwt.claim.sub',fixture_backup_id(1)::text,true);
  IF personal_backup_v329('status')->'copy' IS DISTINCT FROM copy THEN
    RAISE EXCEPTION 'La segunda cuenta sobrescribió la primera';
  END IF;
  RESET ROLE;
  UPDATE public.baptisms SET nombres='Cambio de ensayo' WHERE id=fixture_backup_id(201);
  SET LOCAL ROLE authenticated;
  IF personal_backup_v329('section',null,'bautismos',0,copy_id)->'rows'->0->>'nombres' IS DISTINCT FROM 'Persona ficticia 1' THEN
    RAISE EXCEPTION 'La copia importada se modificó al cambiar datos de trabajo';
  END IF;
  copy:=personal_backup_v329('import',personal_backup_v329('export'));
  BEGIN
    PERFORM personal_backup_v329('section',null,'bautismos',0,copy_id);
    RAISE EXCEPTION 'Una pestaña pudo consultar la nueva copia con el identificador anterior';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  IF personal_backup_v329('section',null,'bautismos',0,(copy->>'id')::uuid)->'rows'->0->>'nombres'
    IS DISTINCT FROM 'Cambio de ensayo' THEN
    RAISE EXCEPTION 'La nueva copia no sustituyó el archivo de la misma cuenta';
  END IF;
  RESET ROLE;
  UPDATE public.baptisms SET nombres='Persona ficticia 1' WHERE id=fixture_backup_id(201);
  UPDATE public.user_profiles SET parish_id=fixture_backup_id(22) WHERE auth_user_id=fixture_backup_id(1);
  SET LOCAL ROLE authenticated;
  IF personal_backup_v329('status')->'copy' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'Un cambio de asignación no cerró el acceso anterior';
  END IF;
  BEGIN
    PERFORM personal_backup_v329('import',file);
    RAISE EXCEPTION 'Se aceptó una copia de la asignación anterior';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub',fixture_backup_id(3)::text,true);
  BEGIN
    PERFORM personal_backup_v329('import',file);
    RAISE EXCEPTION 'Se aceptó un archivo de otro rol';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  copy:=personal_backup_v329('import',personal_backup_v329('export'));
  IF copy->'sections' IS DISTINCT FROM '{"diocesis":1,"vicarias":1,"decanatos":1,"parroquias":2,"informes":1}'::jsonb THEN
    RAISE EXCEPTION 'La copia diocesana salió de ámbito';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',fixture_backup_id(4)::text,true);
  copy:=personal_backup_v329('import',personal_backup_v329('export'));
  rows:=personal_backup_v329('section',null,'cancilleria',0,(copy->>'id')::uuid);
  IF copy->'sections' IS DISTINCT FROM '{"cancilleria":1,"decretos":1,"conceptos":1,"avisos_decretos":1,"constancias_decretos":1}'::jsonb
    OR rows->'rows'->0 ? 'activation_code' THEN
    RAISE EXCEPTION 'La copia de Cancillería salió de ámbito';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',fixture_backup_id(5)::text,true);
  copy:=personal_backup_v329('import',personal_backup_v329('export'));
  IF copy->'sections' IS DISTINCT FROM '{"arquidiocesis":1,"diocesis":2,"parroquias":3}'::jsonb THEN
    RAISE EXCEPTION 'La copia de Administración General excedió su directorio';
  END IF;

  FOR n IN 6..7 LOOP
    PERFORM set_config('request.jwt.claim.sub',fixture_backup_id(n)::text,true);
    BEGIN
      PERFORM personal_backup_v329('export');
      RAISE EXCEPTION 'Se aceptó un perfil inactivo o con adscripción incoherente';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM personal_backup_v329('status');
    RAISE EXCEPTION 'Se aceptó una sesión sin identidad';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
  SELECT count(*) INTO active_count FROM sacramentum_private.personal_backup_imports_v329;
  IF active_count<>5
    OR (SELECT md5(jsonb_agg(to_jsonb(b) ORDER BY b.id)::text) FROM public.baptisms b)<>before_digest THEN
    RAISE EXCEPTION 'La importación escribió fuera de su archivo privado o duplicó una copia';
  END IF;
END;
$test$;
ROLLBACK;

SELECT 'Copias por cuenta V329: aislamiento, cuatro roles, integridad y consulta aprobados' AS resultado;
