-- Esquema mínimo aislado para ensayar la migración y permisos con datos ficticios.
-- Nunca ejecutar este archivo contra una instancia existente.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,aud text,role text,is_anonymous boolean,email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE public.dioceses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL);
CREATE TABLE public.vicarias(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,diocese_id uuid REFERENCES public.dioceses(id));
CREATE TABLE public.parishes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,
 diocese_id uuid REFERENCES public.dioceses(id),vicary_id uuid REFERENCES public.vicarias(id),is_operational boolean DEFAULT true);
CREATE TABLE public.user_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid REFERENCES auth.users(id),
 parish_id uuid REFERENCES public.parishes(id),diocese_id uuid REFERENCES public.dioceses(id),role text,is_active boolean,status text);
CREATE FUNCTION public.current_app_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lower(up.role) FROM public.user_profiles up WHERE up.auth_user_id=auth.uid() AND up.is_active AND upper(up.status)='ACTIVE' LIMIT 1
$$;
CREATE FUNCTION public.current_app_parish_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT up.parish_id FROM public.user_profiles up WHERE up.auth_user_id=auth.uid() AND up.is_active AND upper(up.status)='ACTIVE' LIMIT 1
$$;
CREATE FUNCTION public.current_app_diocese_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT up.diocese_id FROM public.user_profiles up WHERE up.auth_user_id=auth.uid() AND up.is_active AND upper(up.status)='ACTIVE' LIMIT 1
$$;
CREATE FUNCTION public.is_app_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(public.current_app_role()='admin_general',false)
$$;
CREATE FUNCTION public.can_access_parish(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.is_app_admin() OR (public.current_app_role()='parish' AND p_id=public.current_app_parish_id())
 OR (public.current_app_role() IN ('diocese','chancery') AND EXISTS(SELECT 1 FROM public.parishes WHERE id=p_id AND diocese_id=public.current_app_diocese_id()))
$$;
CREATE FUNCTION public.can_manage_legacy_import(p_id uuid,d_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.can_access_parish(p_id) AND d_id=public.current_app_diocese_id()
$$;
CREATE TABLE public.diocesis(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),parish_id uuid REFERENCES public.parishes(id) ON DELETE CASCADE,
 nombre text NOT NULL,codigo text,region text,descripcion text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.iglesias(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),parish_id uuid REFERENCES public.parishes(id) ON DELETE CASCADE,
 codigo text,nombre text,nit text,direccion text,ciudad text,telefono text,fax text,email text,parroco text,diocesis text,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.obispos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),parish_id uuid REFERENCES public.parishes(id) ON DELETE CASCADE,
 nombre text,apellido text,diocesis text,fecha_nombramiento date,fecha_salida date,email text,source_metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.bishop_tenures(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),parish_id uuid NOT NULL REFERENCES public.parishes(id) ON DELETE CASCADE,
 bishop_id uuid REFERENCES public.obispos(id) ON DELETE SET NULL,bishop_name text NOT NULL,start_date date NOT NULL,end_date date,notes text,
 source_metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),CHECK(end_date IS NULL OR end_date>=start_date));
CREATE FUNCTION public.sacramentum_validate_bishop_tenure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER trg_validate_bishop_tenure BEFORE INSERT OR UPDATE ON public.bishop_tenures FOR EACH ROW EXECUTE FUNCTION public.sacramentum_validate_bishop_tenure();
CREATE TABLE public.ciudades(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),context_id uuid,nombre text NOT NULL,source text,count integer,weight integer,usuario text,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.parrocos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),parish_id uuid REFERENCES public.parishes(id),nombre text,apellido text,
 fecha_ingreso date,fecha_salida date,estado text,payload jsonb,created_at timestamptz DEFAULT now());
CREATE TABLE public.mis_datos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL,nombre text);
ALTER TABLE public.parrocos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mis_datos ENABLE ROW LEVEL SECURITY;
CREATE POLICY parrocos_select_scoped ON public.parrocos FOR SELECT TO authenticated USING(parish_id IS NOT NULL AND public.can_access_parish(parish_id));
CREATE POLICY mis_datos_select_scoped ON public.mis_datos FOR SELECT TO authenticated USING(public.is_app_admin() OR
 (public.current_app_role()='parish' AND entity_id=public.current_app_parish_id()));
CREATE TABLE public.legacy_import_batches(id uuid PRIMARY KEY,parish_id uuid,diocese_id uuid,profile_key text,sha256 text,original_filename text);
CREATE TABLE public.legacy_import_rows(id uuid DEFAULT gen_random_uuid(),batch_id uuid,status text,row_number integer,normalized_data jsonb);
CREATE TABLE public.registry_audit_log(actor_user_id uuid,parish_id uuid,diocese_id uuid,entity_type text,entity_id uuid,action text,after_data jsonb,metadata jsonb);
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Registro anterior a la migración: sus UUID y contenido deben conservarse.
DO $$ DECLARE d uuid:=gen_random_uuid();p uuid:=gen_random_uuid(); BEGIN
 INSERT INTO public.dioceses(id,name) VALUES(d,'QA PREEXISTENTE');
 INSERT INTO public.parishes(id,name,diocese_id) VALUES(p,'QA PREEXISTENTE',d);
 INSERT INTO public.ciudades(context_id,nombre,source) VALUES(p,'QA PREEXISTENTE','SEED');
 INSERT INTO public.iglesias(parish_id,codigo,nombre) VALUES(p,'QA PRE','QA PREEXISTENTE');
 INSERT INTO public.diocesis(parish_id,codigo,nombre) VALUES(p,'QA PRE','QA PREEXISTENTE');
END $$;
