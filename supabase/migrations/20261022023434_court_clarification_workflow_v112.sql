-- V112: Requerimientos diocesanos y respuestas de Cancillería, sin efecto registral.
CREATE TABLE public.nullity_court_clarifications_v112 (
 id uuid primary key default gen_random_uuid(),
 receipt_id uuid not null references public.nullity_court_decision_receipts(id),
 diocese_id uuid not null references public.dioceses(id),
 parish_id uuid not null references public.parishes(id),
 request_text text not null check (length(btrim(request_text))>=40),
 request_reference text not null check (length(btrim(request_reference))>=8),
 requested_by uuid not null,
 requested_at timestamptz not null default now(),
 response_text text check (response_text is null or length(btrim(response_text))>=40),
 response_reference text check (response_reference is null or length(btrim(response_reference))>=8),
 responded_by uuid,
 responded_at timestamptz,
 constraint clarification_response_complete check ((response_text is null and response_reference is null and responded_by is null and responded_at is null) or (response_text is not null and response_reference is not null and responded_by is not null and responded_at is not null)),
 constraint clarification_different_actor check (responded_by is null or responded_by<>requested_by)
);
CREATE UNIQUE INDEX nullity_court_clarification_one_open_v112 ON public.nullity_court_clarifications_v112(receipt_id) WHERE responded_at IS NULL;
CREATE INDEX nullity_court_clarifications_receipt_v112 ON public.nullity_court_clarifications_v112(receipt_id,requested_at);
ALTER TABLE public.nullity_court_clarifications_v112 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nullity_court_clarifications_v112 FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.record_court_clarification_v112(p_receipt_id uuid, p_action text, p_text text, p_reference text, p_clarification_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid:=auth.uid();
 v_role text;
 v_diocese uuid;
 v_receipt public.nullity_court_decision_receipts%rowtype;
 v_case public.nullity_judicial_review_cases%rowtype;
 v_clar public.nullity_court_clarifications_v112%rowtype;
 v_id uuid;
 v_c integer;
begin
 if v_actor is null then raise exception 'Sesión autenticada obligatoria' using errcode='42501'; end if;
 select lower(role),diocese_id into v_role,v_diocese from public.user_profiles
 where auth_user_id=v_actor and coalesce(is_active,false)
 and lower(coalesce(status,'active')) not in ('blocked','disabled','inactive') limit 1;
 if v_role not in ('chancery','diocese') or v_diocese is null then
 raise exception 'Acción reservada a Cancillería y Diócesis' using errcode='42501'; end if;
 if p_action not in ('request','respond') or length(btrim(coalesce(p_text,'')))<40
 or length(btrim(coalesce(p_reference,'')))<8 then
 raise exception 'Acción y soporte documental insuficientes' using errcode='23514'; end if;
 select * into v_receipt from public.nullity_court_decision_receipts
 where id=p_receipt_id for update;
 if not found or v_receipt.diocese_id is distinct from v_diocese
 or v_receipt.verification_state<>'unverified'
 or v_receipt.registrar_attestation<>'receipt_only_no_authenticity_or_effects' then
 raise exception 'Recepción inexistente, ajena o con efectos no permitidos' using errcode='42501'; end if;
 select * into v_case from public.nullity_judicial_review_cases
 where id=v_receipt.review_case_id;
 if not found or v_case.diocese_id is distinct from v_diocese
 or v_case.parish_id is distinct from v_receipt.parish_id
 or v_case.nullity_decree_id is distinct from v_receipt.nullity_decree_id
 or v_case.status<>'under_legal_review' then
 raise exception 'Expediente no apto para aclaraciones' using errcode='23514'; end if;
 select count(*) into v_c from public.nullity_court_receipt_checks
 where receipt_id=p_receipt_id and stage in ('chancery_reference_check','diocesan_independent_check');
 if v_c<>2 then raise exception 'Se necesitan ambos contrastes institucionales' using errcode='23514'; end if;
 if p_action='request' then
  if v_role<>'diocese' or p_clarification_id is not null then
   raise exception 'Solo Diócesis puede abrir un requerimiento' using errcode='42501'; end if;
  insert into public.nullity_court_clarifications_v112(
  receipt_id,diocese_id,parish_id,request_text,request_reference,requested_by)
  values(p_receipt_id,v_diocese,v_receipt.parish_id,btrim(p_text),btrim(p_reference),v_actor)
  returning id into v_id;
 else
  if v_role<>'chancery' or p_clarification_id is null then
   raise exception 'Solo Cancillería puede responder un requerimiento identificado' using errcode='42501'; end if;
  select * into v_clar from public.nullity_court_clarifications_v112
  where id=p_clarification_id and receipt_id=p_receipt_id for update;
  if not found or v_clar.diocese_id is distinct from v_diocese or v_clar.responded_at is not null
  or v_clar.requested_by=v_actor then
   raise exception 'Requerimiento inválido, cerrado o sin independencia' using errcode='23514'; end if;
  update public.nullity_court_clarifications_v112 set response_text=btrim(p_text),
   response_reference=btrim(p_reference),responded_by=v_actor,responded_at=now()
  where id=v_clar.id returning id into v_id;
 end if;
 insert into public.registry_audit_log(
 actor_user_id,parish_id,diocese_id,entity_type,entity_id,action,after_data,metadata)
 values(v_actor,v_receipt.parish_id,v_diocese,'nullity_court_clarification',v_id,
 'v112_'||p_action,jsonb_build_object('receipt_id',p_receipt_id,'reference',btrim(p_reference)),
 jsonb_build_object('no_registral_effect',true,'court_receipt_unverified',true));
 return v_id;
end $function$
;
REVOKE ALL ON FUNCTION public.record_court_clarification_v112(uuid,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_court_clarification_v112(uuid,text,text,text,uuid) TO authenticated;
