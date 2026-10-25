-- V204 · Read-only assertion of deterministic seat RPC lock ordering.
-- Inspect four installed RPCs; all must lock parish_parameters ahead of pending_*.
WITH target (signature, pending_relation, early_guard_expected) AS (
 VALUES
 ('public.seat_baptism_records(uuid,jsonb,integer,integer,integer)','pending_baptisms',false),
 ('public.seat_confirmation_records(uuid,jsonb,integer,integer,integer)','pending_confirmations',false),
 ('public.seat_pending_marriage(uuid)','pending_marriages',true),
 ('public.seat_funeral_record(jsonb,uuid)','pending_funerals',true)
),
inspection AS (
 SELECT t.signature,t.pending_relation,t.early_guard_expected,
  pg_get_functiondef(t.signature::regprocedure) AS code,
  p.prosecdef,p.proconfig,p.proacl::text AS acl
 FROM target t
 JOIN pg_proc p ON p.oid=t.signature::regprocedure
),
checks AS (
 SELECT signature,
  (position('from public.parish_parameters' in lower(code))>0) AS parameter_reference_present,
  (position('from public.'||pending_relation in lower(code))>0) AS pending_reference_present,
  (position('from public.parish_parameters' in lower(code))<
   position('from public.'||pending_relation in lower(code))) AS parameters_locked_first_in_source,
  ((position('V204: acquire the common parish numbering lock' in code)>0)=early_guard_expected) AS guard_presence_as_expected,
  (prosecdef IS TRUE) AS retains_security_definer,
  (proconfig=ARRAY['search_path=public']::text[]) AS retains_fixed_search_path,
  (acl='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}') AS retains_exact_grants
 FROM inspection
)
SELECT signature,parameter_reference_present,pending_reference_present,
 parameters_locked_first_in_source,guard_presence_as_expected,
 retains_security_definer,retains_fixed_search_path,retains_exact_grants
FROM checks ORDER BY signature;
