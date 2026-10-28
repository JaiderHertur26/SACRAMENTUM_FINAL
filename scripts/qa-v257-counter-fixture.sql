-- V257: disposable PostgreSQL 16 fixture ONLY. Never deploy this schema.
-- PostgreSQL roles are cluster-wide; V257 and V258 use separate databases
-- in the SAME disposable test container.
DO $qa_roles$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    EXECUTE 'CREATE ROLE authenticated';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    EXECUTE 'CREATE ROLE anon';
  END IF;
END;
$qa_roles$;
CREATE SCHEMA auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid;
$$;
CREATE OR REPLACE FUNCTION public.current_app_role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('qa.app_role',true),'');
$$;
CREATE OR REPLACE FUNCTION public.current_app_parish_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('qa.app_parish',true),'')::uuid;
$$;
CREATE TABLE public.parishes (
 id uuid PRIMARY KEY, diocese_id uuid NOT NULL
);
CREATE TABLE public.user_profiles (
 id uuid PRIMARY KEY, auth_user_id uuid NOT NULL,
 diocese_id uuid, parish_id uuid, role text,
 is_active boolean NOT NULL, status text NOT NULL
);
CREATE TABLE public.parish_parameters (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 parish_id uuid NOT NULL REFERENCES public.parishes(id) UNIQUE,
 bautizos_params jsonb NOT NULL,
 confirmaciones_params jsonb NOT NULL,
 matrimonios_params jsonb NOT NULL,
 exequias_params jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.baptisms (parish_id uuid,numero_registro text);
CREATE TABLE public.confirmations (parish_id uuid,numero_registro text);
CREATE TABLE public.marriages (parish_id uuid,raw_data jsonb);
CREATE TABLE public.funerals (parish_id uuid,numero_registro text);
CREATE TABLE public.pending_baptisms (parish_id uuid,raw_data jsonb);
CREATE TABLE public.pending_confirmations (parish_id uuid,raw_data jsonb);
CREATE TABLE public.pending_marriages (parish_id uuid,raw_data jsonb);
CREATE TABLE public.pending_funerals (parish_id uuid,numero_registro text);
CREATE TABLE public.registry_audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_user_id uuid, parish_id uuid,diocese_id uuid,
 entity_type text NOT NULL,entity_id uuid,action text NOT NULL,
 before_data jsonb,after_data jsonb,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.qa_reject_audit_v257() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
 IF current_setting('qa.fail_audit',true)='yes' THEN
   RAISE EXCEPTION 'QA forced audit failure';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER qa_fail_audit_v257
BEFORE INSERT ON public.registry_audit_log FOR EACH ROW
EXECUTE FUNCTION public.qa_reject_audit_v257();
-- Simulates an unrelated UPDATE OF baptism trigger. A confirmation/funeral
-- counter must not fire it by assigning the unchanged baptism JSON.
CREATE OR REPLACE FUNCTION public.qa_baptism_update_guard_v257() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
 IF current_setting('qa.reject_baptism_update',true)='yes' THEN
   RAISE EXCEPTION 'QA baptism-only trigger must NOT fire for another sacrament';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER qa_baptism_update_guard_v257
BEFORE UPDATE OF bautizos_params ON public.parish_parameters FOR EACH ROW
EXECUTE FUNCTION public.qa_baptism_update_guard_v257();
INSERT INTO public.parishes(id,diocese_id) VALUES
('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000002');
INSERT INTO public.user_profiles(id,auth_user_id,diocese_id,parish_id,role,is_active,status) VALUES
('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','parish',true,'ACTIVE'),
('00000000-0000-0000-0000-000000000502','00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000102','parish',true,'ACTIVE');
INSERT INTO public.parish_parameters(parish_id,bautizos_params,confirmaciones_params,matrimonios_params,exequias_params) VALUES
('00000000-0000-0000-0000-000000000101',
 '{"numeroRegistroActual":"000009","ordinarioLibro":"0001A","ordinarioFolio":"0002","ordinarioNumero":"0003"}',
 '{"numeroRegistroActual":"000009","ordinarioLibro":"0002B","ordinarioFolio":"0005"}',
 '{"numeroRegistroActual":"00000009","ordinarioLibro":"0003C","ordinarioFolio":"0007"}',
 '{"numeroRegistroActual":"000009","libro":"0004D","folio":"0006"}'),
('00000000-0000-0000-0000-000000000102',
 '{"numeroRegistroActual":"000007","ordinarioLibro":"0010"}',
 '{"numeroRegistroActual":"000007"}','{"numeroRegistroActual":"00000007"}','{"numeroRegistroActual":"000007"}');
INSERT INTO public.baptisms(parish_id,numero_registro)
VALUES('00000000-0000-0000-0000-000000000101','000013');
-- SECURITY ASSERTION: no direct writes allowed in throwaway environment.
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
GRANT USAGE ON SCHEMA public TO authenticated,anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,authenticated,anon;
