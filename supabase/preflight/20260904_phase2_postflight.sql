-- ============================================================================
-- SACRAMENTUM · POST-FLIGHT FASE 2 (SOLO LECTURA)
-- Ejecutar DESPUÉS de aplicar todas las migraciones/RLS 001–014.
-- ============================================================================
select * from public.sacramentum_registry_health();

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'funerals','pending_funerals','pending_marriages','official_notifications',
    'matrimonial_notifications','matrimonial_notification_recipients',
    'registry_audit_log','document_sequences'
  )
order by table_name;

select routine_name
from information_schema.routines
where routine_schema='public'
  and routine_name in (
    'apply_baptism_correction','apply_confirmation_correction','apply_funeral_correction',
    'apply_baptism_replacement','apply_confirmation_replacement','apply_marriage_nullity',
    'seat_baptism_records','seat_confirmation_records','seat_pending_marriage','seat_funeral_record',
    'issue_matrimonial_notification','process_matrimonial_notification_recipient',
    'cancel_matrimonial_notification','archive_matrimonial_notification_recipient',
    'reverse_correction_decree','reverse_replacement_decree',
    'register_historical_baptism','register_historical_confirmation','register_historical_marriage',
    'register_historical_funeral','search_baptisms_for_matrimonial_notification',
    'current_effective_diocese_id'
  )
order by routine_name;

select schemaname,tablename,policyname,cmd
from pg_policies
where schemaname='public'
  and tablename in (
    'baptisms','confirmations','marriages','funerals','decretos','marginal_notes',
    'official_notifications','matrimonial_notifications','matrimonial_notification_recipients',
    'registry_audit_log','conceptos_anulacion','vicarias','decanatos','chancelleries','parishes','dioceses'
  )
order by tablename,policyname;

-- Gobierno y configuración final esperada.
select table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public'
  and (
    (table_name='conceptos_anulacion' and column_name in ('is_active','updated_at'))
    or (table_name='parish_parameters' and column_name in ('exequias_params','marginal_notes_templates'))
    or (table_name='decretos' and column_name in ('diocese_id','chancery_id','sacrament_type','decree_number','decree_date','original_record_id','replacement_record_id','status','issued_by'))
  )
order by table_name,column_name;

-- Ninguna tabla sacramental debería tener duplicados Libro/Folio/Número por parroquia.
select 'baptisms' as source, parish_id, book_number, folio, number, count(*)
from public.baptisms group by parish_id,book_number,folio,number having count(*)>1
union all
select 'confirmations', parish_id, book_number, folio, number, count(*)
from public.confirmations group by parish_id,book_number,folio,number having count(*)>1
union all
select 'marriages', parish_id, book_number, folio, number, count(*)
from public.marriages group by parish_id,book_number,folio,number having count(*)>1
union all
select 'funerals', parish_id, book_number, folio, number, count(*)
from public.funerals group by parish_id,book_number,folio,number having count(*)>1;

-- Restricciones de integridad que deberían existir si el preflight no encontró conflictos.
select tablename,indexname,indexdef
from pg_indexes
where schemaname='public'
  and indexname in (
    'uq_baptisms_registry_number','uq_confirmations_registry_number','uq_marriages_registry_number','uq_funerals_registry_number',
    'uq_parish_parameters_parish','uq_sacrament_books_scope','uq_user_profiles_auth_user','uq_pending_tokens_token',
    'uq_decretos_diocese_number','uq_active_chancery_user'
  )
order by indexname;

-- Fase 2.16 · gobierno de identidad
select routine_name
from information_schema.routines
where routine_schema='public'
  and routine_name in ('update_managed_user_profile','set_managed_user_active')
order by routine_name;

select tablename, policyname, cmd
from pg_policies
where schemaname='public' and tablename='pending_tokens'
order by policyname;
