// Generates disposable PG16 source schema; NO actual data.
import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync('AUDITORIA_MATRIZ_RESET_V267_2026-10-28.json','utf8'));
const tables=[...m.preserve,...m.zeroRequired];
const sql=[
"DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$;",
"CREATE SCHEMA auth;",
"CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$ SELECT nullif(current_setting('qa.actor',true),'')::uuid $$;"
];
for(const t of tables)sql.push('CREATE TABLE public."'+t+'" ('+
 'id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parish_id uuid, diocese_id uuid,'+
 'auth_user_id uuid, role text, is_active boolean, status text DEFAULT \'pending\','+
 'chancery_id uuid,is_operational boolean DEFAULT true,'+
 'reportado boolean DEFAULT false, raw_data jsonb DEFAULT \'{}\'::jsonb,'+
 'book_number text, book_type text DEFAULT \'ordinario\', folio text, number text,'+
 'actor_user_id uuid,entity_type text,entity_id uuid,action text,after_data jsonb,metadata jsonb,'+
 'bautizos_params jsonb DEFAULT \'{}\'::jsonb,confirmaciones_params jsonb DEFAULT \'{}\'::jsonb,'+
 'matrimonios_params jsonb DEFAULT \'{}\'::jsonb,exequias_params jsonb DEFAULT \'{}\'::jsonb,'+
 'updated_at timestamptz DEFAULT now());');
sql.push("CREATE UNIQUE INDEX uq_v260_baptism_physical_coordinates ON public.baptisms(parish_id,book_number,folio,number) NULLS NOT DISTINCT;");
sql.push("CREATE UNIQUE INDEX uq_v260_confirmation_physical_coordinates ON public.confirmations(parish_id,book_number,folio,number) NULLS NOT DISTINCT;");
sql.push("CREATE UNIQUE INDEX uq_v260_marriage_physical_coordinates ON public.marriages(parish_id,book_type,book_number,folio,number) NULLS NOT DISTINCT;");
sql.push("CREATE UNIQUE INDEX uq_v260_funeral_physical_coordinates ON public.funerals(parish_id,book_type,book_number,folio,number) NULLS NOT DISTINCT;");
sql.push("CREATE SCHEMA IF NOT EXISTS sacramentum_ledger;");
sql.push("INSERT INTO public.parishes(id,diocese_id) VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010');");
sql.push("INSERT INTO public.chancelleries(id,diocese_id) VALUES ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000010');");
sql.push("INSERT INTO public.user_profiles(auth_user_id,parish_id,diocese_id,role,is_active,status) VALUES ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','parish',true,'ACTIVE'),('00000000-0000-0000-0000-000000000031',null,'00000000-0000-0000-0000-000000000010','chancery',true,'ACTIVE'); UPDATE public.user_profiles SET chancery_id='00000000-0000-0000-0000-000000000040' WHERE role='chancery';");
sql.push("INSERT INTO public.parish_parameters(parish_id,bautizos_params,confirmaciones_params,matrimonios_params,exequias_params) VALUES('00000000-0000-0000-0000-000000000001',jsonb_build_object('numeroRegistroActual','000053','partidasPorFolio',2),jsonb_build_object('numeroRegistroActual','000023'),jsonb_build_object('numeroRegistroActual','0012'),jsonb_build_object('numeroRegistroActual','0002'));");
for(const old of [
 'seat_baptism_records(uuid,jsonb,integer,integer,integer)',
 'seat_confirmation_records(uuid,jsonb,integer,integer,integer)',
 'seat_pending_marriage(uuid)','seat_funeral_record(jsonb,uuid)'
])sql.push("CREATE FUNCTION public."+old+" RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;");
for(const newer of [
 'seat_baptism_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
 'seat_confirmation_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
 'seat_marriage_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
 'seat_funeral_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)'
])sql.push("CREATE FUNCTION public."+newer+" RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;");
sql.push("CREATE FUNCTION public.get_parish_ledger_seat_context_v264(uuid,text,jsonb) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;");
sql.push("CREATE FUNCTION public.attest_new_celebration_v265(uuid,text,uuid,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;");
// V273: these stage-only RPCs remain ungranted until the atomic V267 cutover.
for(const fn of [
 'get_parish_ledger_seat_context_v264(uuid,text,jsonb)',
 'attest_new_celebration_v265(uuid,text,uuid,text)'
])sql.push('REVOKE ALL ON FUNCTION public.'+fn+' FROM PUBLIC,anon,authenticated;');
for(const newer of [
 'seat_baptism_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
 'seat_confirmation_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
 'seat_marriage_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)',
 'seat_funeral_ledger_v263(uuid,uuid,bigint,integer,integer,uuid,jsonb)'
])sql.push("REVOKE ALL ON FUNCTION public."+newer+" FROM PUBLIC,anon,authenticated;");
sql.push("CREATE TABLE sacramentum_ledger.celebration_attestations_v263(pending_id uuid PRIMARY KEY,parish_id uuid,sacrament text,origin text,verified_at timestamptz,verified_by uuid,evidence_ref text);");
process.stdout.write(sql.join('\n')+'\n');
