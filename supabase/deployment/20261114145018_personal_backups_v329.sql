-- Las copias importadas pertenecen a una cuenta y a su ámbito institucional actual.
CREATE TABLE IF NOT EXISTS sacramentum_private.personal_backup_key_v329 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  secret bytea NOT NULL CHECK (octet_length(secret)=32)
);
ALTER TABLE sacramentum_private.personal_backup_key_v329 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_private.personal_backup_key_v329 FROM PUBLIC, anon, authenticated;
INSERT INTO sacramentum_private.personal_backup_key_v329(singleton,secret)
VALUES (true,extensions.gen_random_bytes(32)) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS sacramentum_private.personal_backup_imports_v329 (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope jsonb NOT NULL,
  copy_id uuid NOT NULL,
  sealed bytea NOT NULL,
  summary jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, scope)
);
ALTER TABLE sacramentum_private.personal_backup_imports_v329 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sacramentum_private.personal_backup_imports_v329 FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION sacramentum_private.backup_sections_v329(p public.user_profiles)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $sections$
DECLARE
  sections jsonb;
  source record;
  rows jsonb;
BEGIN
  CASE p.role
    WHEN 'parish' THEN
      sections:=jsonb_build_object(
        'parroquias',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.parishes r WHERE r.id=p.parish_id),'[]'::jsonb),
        'parrocos',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.parrocos r WHERE r.parish_id=p.parish_id),'[]'::jsonb),
        'mis_datos',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.mis_datos r WHERE r.entity_id=p.parish_id),'[]'::jsonb),
        'parametros',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.parish_parameters r WHERE r.parish_id=p.parish_id),'[]'::jsonb),
        'decretos',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.decree_date,r.id) FROM public.decretos r
          WHERE r.parish_id=p.parish_id AND r.diocese_id=p.diocese_id),'[]'::jsonb)
      );
      FOR source IN SELECT * FROM (VALUES
        ('bautismos','baptisms'), ('confirmaciones','confirmations'),
        ('matrimonios','marriages'), ('exequias','funerals'),
        ('bautismos_pendientes','pending_baptisms'), ('confirmaciones_pendientes','pending_confirmations'),
        ('matrimonios_pendientes','pending_marriages'), ('exequias_pendientes','pending_funerals'),
        ('expedientes','marriage_dossiers'), ('notas_marginales','marginal_notes')
      ) AS sources(section, relation) LOOP
        EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),''[]''::jsonb)
          FROM public.%I r WHERE r.parish_id=$1',source.relation) INTO rows USING p.parish_id;
        sections:=sections || jsonb_build_object(source.section,rows);
      END LOOP;
    WHEN 'diocese' THEN
      sections:=jsonb_build_object(
        'diocesis',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM public.dioceses r WHERE r.id=p.diocese_id),'[]'::jsonb),
        'vicarias',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.vicarias r WHERE r.diocese_id=p.diocese_id),'[]'::jsonb),
        'decanatos',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.decanatos r WHERE r.diocese_id=p.diocese_id),'[]'::jsonb),
        'parroquias',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.parishes r WHERE r.diocese_id=p.diocese_id),'[]'::jsonb),
        'informes',coalesce((SELECT jsonb_agg(to_jsonb(r)-'generated_by' ORDER BY r.generated_at,r.id)
          FROM public.diocesan_report_runs r WHERE r.diocese_id=p.diocese_id AND r.generated_by=p.auth_user_id),'[]'::jsonb)
      );
    WHEN 'chancery' THEN
      sections:=jsonb_build_object(
        'cancilleria',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.name,'ciudad',r.city,
          'canciller',r.chancellor_name,'vicecanciller',r.vice_chancellor_name))
          FROM public.chancelleries r WHERE r.id=p.chancery_id AND r.diocese_id=p.diocese_id),'[]'::jsonb),
        'decretos',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.decree_date,r.id) FROM public.decretos r
          WHERE r.chancery_id=p.chancery_id AND r.diocese_id=p.diocese_id),'[]'::jsonb),
        'conceptos',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.conceptos_anulacion r
          WHERE r.diocese_id=p.diocese_id),'[]'::jsonb),
        'avisos_decretos',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.official_notifications r
          WHERE r.sender_chancery_id=p.chancery_id AND r.diocese_id=p.diocese_id AND r.category='decree'),'[]'::jsonb),
        'constancias_decretos',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.decree_id)
          FROM sacramentum_ledger.decree_seat_receipts_v280 r JOIN public.decretos d ON d.id=r.decree_id
          WHERE d.chancery_id=p.chancery_id AND d.diocese_id=p.diocese_id),'[]'::jsonb)
      );
    WHEN 'admin_general' THEN
      sections:=jsonb_build_object(
        'arquidiocesis',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.name) ORDER BY r.id)
          FROM public.archdioceses r),'[]'::jsonb),
        'diocesis',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.name,'tipo',r.type,
          'ciudad',r.city,'archdiocese_id',r.archdiocese_id) ORDER BY r.id) FROM public.dioceses r),'[]'::jsonb),
        'parroquias',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.name,'ciudad',r.city,
          'diocese_id',r.diocese_id,'is_operational',r.is_operational) ORDER BY r.id) FROM public.parishes r),'[]'::jsonb)
      );
    ELSE RAISE EXCEPTION 'Rol sin acceso a copias de seguridad.' USING ERRCODE='42501';
  END CASE;
  RETURN sections;
END;
$sections$;
REVOKE ALL ON FUNCTION sacramentum_private.backup_sections_v329(public.user_profiles) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.personal_backup_v329(
  p_action text, p_file jsonb DEFAULT NULL, p_section text DEFAULT NULL, p_offset integer DEFAULT 0,
  p_copy_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $backup$
DECLARE
  account public.user_profiles%ROWTYPE;
  owner uuid:=auth.uid();
  account_scope jsonb;
  prior sacramentum_private.personal_backup_imports_v329%ROWTYPE;
  secret bytea;
  mac_key bytea;
  passphrase text;
  sealed bytea;
  payload jsonb;
  sections jsonb;
  selected_rows jsonb;
  summary jsonb;
  copy_id uuid;
  exported_at timestamptz;
  page_size constant integer:=25;
BEGIN
  SELECT u.* INTO account FROM public.user_profiles u
  WHERE u.auth_user_id=owner AND u.is_active IS TRUE AND upper(u.status)='ACTIVE';
  IF NOT FOUND OR coalesce(account.role,'') NOT IN ('parish','chancery','diocese','admin_general')
    OR (account.role='parish' AND NOT EXISTS(SELECT 1 FROM public.parishes r
      WHERE r.id=account.parish_id AND r.diocese_id=account.diocese_id))
    OR (account.role='chancery' AND NOT EXISTS(SELECT 1 FROM public.chancelleries r
      WHERE r.id=account.chancery_id AND r.diocese_id=account.diocese_id))
    OR (account.role='diocese' AND NOT EXISTS(SELECT 1 FROM public.dioceses r WHERE r.id=account.diocese_id)) THEN
    RAISE EXCEPTION 'Se requiere una cuenta institucional activa con ámbito asignado.' USING ERRCODE='42501';
  END IF;
  -- Evita seleccionar arbitrariamente un perfil si la vinculación de la cuenta es ambigua.
  IF (SELECT count(*) FROM public.user_profiles u WHERE u.auth_user_id=owner
      AND u.is_active IS TRUE AND upper(u.status)='ACTIVE')<>1 THEN
    RAISE EXCEPTION 'El perfil de esta cuenta requiere revisión.' USING ERRCODE='42501';
  END IF;

  account_scope:=jsonb_build_array(owner,account.id,account.role,
    CASE WHEN account.role IN('parish','diocese','chancery') THEN account.diocese_id END,
    CASE WHEN account.role='parish' THEN account.parish_id WHEN account.role='chancery' THEN account.chancery_id END);

  IF p_action IN ('status','section') THEN
    SELECT s.* INTO prior FROM sacramentum_private.personal_backup_imports_v329 s
    WHERE s.owner_id=owner AND s.scope=account_scope;
    IF p_action='status' THEN
      RETURN jsonb_build_object('role',account.role,'copy',prior.summary);
    END IF;
    IF prior.copy_id IS DISTINCT FROM p_copy_id THEN
      RAISE EXCEPTION 'La copia cambió. Vuelva a consultar su copia importada.' USING ERRCODE='22023';
    END IF;
    IF prior.copy_id IS NULL OR p_section IS NULL OR NOT coalesce((prior.summary->'sections') ? p_section,false)
      OR p_offset IS NULL OR p_offset<0 THEN
      RAISE EXCEPTION 'Elija una sección de su copia importada.' USING ERRCODE='22023';
    END IF;
  END IF;

  SELECT k.secret INTO STRICT secret FROM sacramentum_private.personal_backup_key_v329 k WHERE k.singleton;
  passphrase:=encode(extensions.hmac(convert_to('backup-v1-encryption:'||account_scope::text,'UTF8'),secret,'sha256'),'hex');
  mac_key:=extensions.hmac(convert_to('backup-v1-integrity:'||account_scope::text,'UTF8'),secret,'sha256');

  CASE p_action
    WHEN 'export' THEN
      exported_at:=clock_timestamp();
      payload:=jsonb_build_object('id',gen_random_uuid(),'exportedAt',exported_at,'role',account.role,'sections',
        sacramentum_private.backup_sections_v329(account));
      IF octet_length(payload::text)>64*1024*1024 THEN
        RAISE EXCEPTION 'Los datos de la copia superan el tamaño admitido.';
      END IF;
      sealed:=extensions.pgp_sym_encrypt(payload::text,passphrase,'cipher-algo=aes256,compress-algo=2');
      IF octet_length(sealed)>12*1024*1024 THEN RAISE EXCEPTION 'El archivo de copia supera el tamaño admitido.'; END IF;
      RETURN jsonb_build_object('format','SACRAMENTUM_PERSONAL_BACKUP','version',1,'role',account.role,
        'exportedAt',exported_at,'sealed',encode(sealed,'base64'),
        'integrity',encode(extensions.hmac(sealed,mac_key,'sha256'),'hex'));

    WHEN 'import' THEN
      IF jsonb_typeof(p_file) IS DISTINCT FROM 'object'
        OR p_file->>'format' IS DISTINCT FROM 'SACRAMENTUM_PERSONAL_BACKUP'
        OR p_file->'version' IS DISTINCT FROM '1'::jsonb
        OR p_file->>'role' IS DISTINCT FROM account.role
        OR coalesce(p_file->>'integrity','') !~ '^[a-f0-9]{64}$'
        OR jsonb_typeof(p_file->'sealed') IS DISTINCT FROM 'string'
        OR length(p_file->>'sealed') NOT BETWEEN 64 AND 17*1024*1024 THEN
        RAISE EXCEPTION 'El archivo no corresponde a una copia compatible con su rol.' USING ERRCODE='22023';
      END IF;
      BEGIN
        sealed:=decode(p_file->>'sealed','base64');
        IF octet_length(sealed)>12*1024*1024 OR
            extensions.hmac(sealed,mac_key,'sha256')<>decode(p_file->>'integrity','hex') THEN
          RAISE EXCEPTION 'Integridad de la copia no válida';
        END IF;
        payload:=extensions.pgp_sym_decrypt(sealed,passphrase)::jsonb;
        IF payload->>'role' IS DISTINCT FROM account.role OR payload->'exportedAt' IS DISTINCT FROM p_file->'exportedAt' THEN
          RAISE EXCEPTION 'Metadatos de la copia no válidos';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'La copia está dañada o pertenece a otra cuenta o ámbito.' USING ERRCODE='22023';
      END;

      copy_id:=(payload->>'id')::uuid;
      exported_at:=(payload->>'exportedAt')::timestamptz;
      SELECT jsonb_build_object('id',copy_id,'exportedAt',exported_at,'importedAt',clock_timestamp(),
        'sections',coalesce(jsonb_object_agg(x.key,jsonb_array_length(x.value)),'{}'::jsonb))
      INTO summary FROM jsonb_each(payload->'sections') x;

      INSERT INTO sacramentum_private.personal_backup_imports_v329 AS s(owner_id,scope,copy_id,sealed,summary)
      VALUES (owner,account_scope,copy_id,sealed,summary)
      ON CONFLICT ON CONSTRAINT personal_backup_imports_v329_pkey DO UPDATE SET
        copy_id=EXCLUDED.copy_id,sealed=EXCLUDED.sealed,summary=EXCLUDED.summary,imported_at=now()
      WHERE s.copy_id IS DISTINCT FROM EXCLUDED.copy_id;
      SELECT s.summary INTO STRICT summary FROM sacramentum_private.personal_backup_imports_v329 s
      WHERE s.owner_id=owner AND s.scope=account_scope;
      RETURN summary;

    WHEN 'section' THEN
      sections:=(extensions.pgp_sym_decrypt(prior.sealed,passphrase)::jsonb)->'sections';
      selected_rows:=sections->p_section;
      RETURN jsonb_build_object(
        'total',jsonb_array_length(selected_rows),
        'rows',coalesce((SELECT jsonb_agg(q.value ORDER BY q.ordinality)
           FROM (SELECT x.* FROM jsonb_array_elements(selected_rows) WITH ORDINALITY x
             ORDER BY x.ordinality OFFSET p_offset LIMIT page_size) q),'[]'::jsonb)
      );

    ELSE RAISE EXCEPTION 'Operación de copia no disponible.' USING ERRCODE='22023';
  END CASE;
END;
$backup$;
REVOKE ALL ON FUNCTION public.personal_backup_v329(text,jsonb,text,integer,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personal_backup_v329(text,jsonb,text,integer,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
