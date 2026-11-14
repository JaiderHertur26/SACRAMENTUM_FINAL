-- Esquema y datos ficticios para ensayar las copias por cuenta.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE SCHEMA sacramentum_private;
CREATE SCHEMA sacramentum_ledger;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA auth, sacramentum_private TO authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE FUNCTION public.fixture_backup_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;

CREATE TABLE public.user_profiles(id uuid,auth_user_id uuid,role text,status text,is_active boolean,
  parish_id uuid,diocese_id uuid,chancery_id uuid);
CREATE TABLE public.archdioceses(id uuid,name text);
CREATE TABLE public.dioceses(id uuid,name text,type text,city text,archdiocese_id uuid);
CREATE TABLE public.parishes(id uuid,name text,city text,diocese_id uuid,is_operational boolean);
CREATE TABLE public.chancelleries(id uuid,name text,city text,diocese_id uuid,
  chancellor_name text,vice_chancellor_name text,activation_code text);
CREATE TABLE public.parrocos(id uuid,parish_id uuid,nombre text);
CREATE TABLE public.mis_datos(id uuid,entity_id uuid,nombre text);
CREATE TABLE public.parish_parameters(id uuid,parish_id uuid);
CREATE TABLE public.decretos(id uuid,diocese_id uuid,chancery_id uuid,parish_id uuid,decree_date date,decree_number text);
CREATE TABLE public.baptisms(id uuid,parish_id uuid,nombres text,book_number text,folio text,number text);
CREATE TABLE public.vicarias(id uuid,diocese_id uuid);
CREATE TABLE public.decanatos(id uuid,diocese_id uuid);
CREATE TABLE public.diocesan_report_runs(id uuid,diocese_id uuid,generated_by uuid,generated_at timestamptz);
CREATE TABLE public.conceptos_anulacion(id uuid,diocese_id uuid);
CREATE TABLE public.official_notifications(id uuid,diocese_id uuid,sender_chancery_id uuid,category text);
CREATE TABLE sacramentum_ledger.decree_seat_receipts_v280(decree_id uuid);
DO $fixtures$
DECLARE relation text;
BEGIN
  FOREACH relation IN ARRAY ARRAY['confirmations','marriages','funerals','pending_baptisms',
    'pending_confirmations','pending_marriages','pending_funerals','marriage_dossiers','marginal_notes'] LOOP
    EXECUTE format('CREATE TABLE public.%I(id uuid, parish_id uuid)',relation);
    EXECUTE format('INSERT INTO public.%I VALUES (fixture_backup_id(60),fixture_backup_id(21)),
      (fixture_backup_id(61),fixture_backup_id(22))',relation);
  END LOOP;
END;
$fixtures$;

INSERT INTO auth.users SELECT fixture_backup_id(n) FROM generate_series(1,8) n;
INSERT INTO public.archdioceses VALUES (fixture_backup_id(11),'Arquidiócesis de ensayo');
INSERT INTO public.dioceses SELECT fixture_backup_id(n),'Diócesis '||n,'diocese','Ciudad',fixture_backup_id(11)
  FROM generate_series(12,13) n;
INSERT INTO public.parishes VALUES
  (fixture_backup_id(21),'Parroquia de ensayo','Ciudad',fixture_backup_id(12),true),
  (fixture_backup_id(22),'Otra parroquia','Ciudad',fixture_backup_id(12),true),
  (fixture_backup_id(23),'Parroquia ajena','Ciudad',fixture_backup_id(13),true);
INSERT INTO public.chancelleries VALUES
  (fixture_backup_id(31),'Cancillería de ensayo','Ciudad',fixture_backup_id(12),'Canciller',null,'CODIGO-DE-ENSAYO'),
  (fixture_backup_id(32),'Otra Cancillería','Ciudad',fixture_backup_id(12),null,null,null),
  (fixture_backup_id(33),'Cancillería ajena','Ciudad',fixture_backup_id(13),null,null,null);
INSERT INTO public.user_profiles
SELECT fixture_backup_id(n+100),fixture_backup_id(n),role,status,true,
  CASE WHEN p IS NOT NULL THEN fixture_backup_id(p) END,
  CASE WHEN d IS NOT NULL THEN fixture_backup_id(d) END,
  CASE WHEN c IS NOT NULL THEN fixture_backup_id(c) END
FROM (VALUES (1,'parish','ACTIVE',21,12,null), (2,'parish','ACTIVE',21,12,null),
  (3,'diocese','ACTIVE',null,12,null), (4,'chancery','ACTIVE',null,12,31),
  (5,'admin_general','ACTIVE',null,null,null), (6,'parish','INACTIVE',21,12,null),
  (7,'chancery','ACTIVE',null,12,33), (8,'diocese','ACTIVE',null,12,null)
) profiles(n,role,status,p,d,c);
INSERT INTO public.baptisms
SELECT fixture_backup_id(200+n),fixture_backup_id(21),'Persona ficticia '||n,'1','2',n::text
  FROM generate_series(1,27) n;
INSERT INTO public.baptisms VALUES (fixture_backup_id(250),fixture_backup_id(22),'Registro ajeno','1','2','28');
INSERT INTO public.parrocos VALUES (fixture_backup_id(51),fixture_backup_id(21),'Párroco de ensayo');
INSERT INTO public.mis_datos VALUES (fixture_backup_id(52),fixture_backup_id(21),'Parroquia de ensayo');
INSERT INTO public.parish_parameters VALUES (fixture_backup_id(53),fixture_backup_id(21));
INSERT INTO public.decretos
SELECT fixture_backup_id(n),fixture_backup_id(d),fixture_backup_id(c),fixture_backup_id(p),
  '2026-11-01','Decreto '||n
FROM (VALUES(41,12,31,21),(42,12,32,22),(43,13,33,23)) decrees(n,d,c,p);
INSERT INTO sacramentum_ledger.decree_seat_receipts_v280
  SELECT id FROM public.decretos;
INSERT INTO public.official_notifications
  SELECT id,diocese_id,chancery_id,'decree' FROM public.decretos;
INSERT INTO public.official_notifications VALUES
  (fixture_backup_id(44),fixture_backup_id(12),fixture_backup_id(31),'general');
INSERT INTO public.vicarias VALUES (fixture_backup_id(45),fixture_backup_id(12)),(fixture_backup_id(46),fixture_backup_id(13));
INSERT INTO public.decanatos VALUES (fixture_backup_id(47),fixture_backup_id(12)),(fixture_backup_id(48),fixture_backup_id(13));
INSERT INTO public.conceptos_anulacion VALUES (fixture_backup_id(49),fixture_backup_id(12)),(fixture_backup_id(50),fixture_backup_id(13));
INSERT INTO public.diocesan_report_runs
SELECT fixture_backup_id(n),fixture_backup_id(d),fixture_backup_id(u),now()
FROM (VALUES(54,12,3),(55,12,8),(56,13,3)) reports(n,d,u);
