begin;
set local request.jwt.claims = '{"sub":"6eebfea0-5280-4d96-bc38-e9f0021fbb25","role":"authenticated"}';

select * from public.register_historical_baptism(
  'ada2c810-c6eb-4b75-8e3c-4941e3022687',
  '{"Libro":"9999","folio":"9999","numero":"9999","fechaSacramento":"2000-01-02","fechaNacimiento":"1999-12-31","nombres":"PRUEBA TRANSACCIONAL","apellidos":"SACRAMENTUM QA","lugarBautismo":"QA ROLLBACK"}'::jsonb
);

select
  exists(select 1 from public.baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and book_number='9999' and folio='9999' and number='9999') as row_created,
  exists(select 1 from public.baptisms where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687' and book_number='9999' and raw_data->>'source'='historical_book_digitization') as source_ok,
  exists(select 1 from public.registry_audit_log where entity_type='baptism' and action='historical_digitization' and metadata->>'book'='9999' and metadata->>'changes_live_sequence'='false') as audit_ok,
  (select bautizos_params->>'ordinarioLibro' from public.parish_parameters where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as libro,
  (select bautizos_params->>'ordinarioFolio' from public.parish_parameters where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as folio,
  (select bautizos_params->>'ordinarioNumero' from public.parish_parameters where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as numero,
  (select bautizos_params->>'numeroRegistroActual' from public.parish_parameters where parish_id='ada2c810-c6eb-4b75-8e3c-4941e3022687') as registro;

rollback;