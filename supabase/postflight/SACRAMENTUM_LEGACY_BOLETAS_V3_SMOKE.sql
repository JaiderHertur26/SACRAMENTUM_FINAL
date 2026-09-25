begin;
insert into public.legacy_pre_sacrament_registrations(
 profile_key,source_sha256,source_key,sacrament_type,celebration_date,names,last_names,reported,original_data,normalized_data
) values
('INSBAUTI','SMOKE-V3','TRUE','baptism','2099-01-01','PRUEBA TRUE','BOLETA',true,'{}','{}'),
('INSBAUTI','SMOKE-V3','FALSE','baptism','2099-01-01','PRUEBA FALSE','BOLETA',false,'{}','{}');
select public.reconcile_legacy_pre_registrations('INSBAUTI') as reconciliation_result;
select source_key,reported,reconciliation_status,match_method
from public.legacy_pre_sacrament_registrations
where source_sha256='SMOKE-V3' order by source_key;
rollback;
