-- SACRAMENTUM V53 · Cierre de brechas legacy P0/P1
-- Preserva el original FRX/FRT y añade reconstrucciones modernas sólo cuando el texto histórico no sobrevivió completo.

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  null,
  'MODERN-7206-CAUCIONES',
  'Cauciones para matrimonio mixto o disparidad de culto',
  'canonical_declaration',
  'En relación con el matrimonio de <ParteCatolica> con <OtraParte>, la parte católica declara que está dispuesta a conservar la fe católica y a evitar cuanto pueda apartarla de ella; asimismo, promete sinceramente hacer cuanto le sea posible para que los hijos sean bautizados y educados en la Iglesia católica.

La otra parte declara haber sido informada oportunamente de estos compromisos y manifiesta conocer su contenido.

Ambos contrayentes declaran haber recibido instrucción sobre los fines y propiedades esenciales del matrimonio, que ninguno de ellos excluye.

Para constancia, se suscribe la presente declaración en <Miciudad>, el <Fecha>.

Parte católica: <ParteCatolica> · Documento: <DocumentoCatolico>
Otra parte: <OtraParte> · Documento: <DocumentoOtraParte>',
  array['ParteCatolica','OtraParte','Miciudad','Fecha','DocumentoCatolico','DocumentoOtraParte']::text[],
  'system',null,null,1,true,false,
  jsonb_build_object(
    'source_system','SACRAMENTUM',
    'reconstruction_basis','rpt_doc7206-B.frx / rpt_doc7206-B.frt',
    'legacy_report_key','rpt_doc7206-B',
    'legacy_evidence','El FRX preserva el título CAUCIONES, dos cuerpos editables y dos bloques de firma, pero no el contenido de los cuerpos editables.',
    'canonical_basis',jsonb_build_array('CIC 1125','CIC 1126','CIC 1086'),
    'review_status','modern_reconstruction_not_legacy_text',
    'created_by_migration','V53'
  )
where not exists(
  select 1 from public.document_templates
  where code='MODERN-7206-CAUCIONES' and scope_type='system' and version=1
);
-- Equivalencias cerradas por módulos modernos verificables.
update public.legacy_report_definitions
set audit_status='IMPLEMENTADO',
    current_equivalent='ConfirmationNotificationPage + flujo de acuse y nota marginal',
    gap='Equivalente moderno implementado: emisor específico de notificación de Confirmación, referencia bautismal, destinatario, acuse y trazabilidad.',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('closed_by_version','V53','verification','functional_equivalent')
where report_key='rpt_avisocon';

update public.legacy_report_definitions
set audit_status='IMPLEMENTADO',
    current_equivalent='MarriageDossierPage + marriageDossierPdf',
    gap='Expediente matrimonial digital con entrevistas de ambos contrayentes, dos testigos, documentos, impedimentos, dispensas, valoración, acta y PDF profesional.',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('closed_by_version','V51','verification','functional_equivalent')
where report_key in ('rpt_expedhoja1','rpt_expedhoja2','rpt_expedhoja3','rpt_expedhoja4');

update public.legacy_report_definitions
set audit_status='IMPLEMENTADO',
    current_equivalent='SacramentalBooksPage + sacramentalBookPdf',
    gap='Libro sacramental completo, filtrable y paginado en PDF institucional para Bautismo, Confirmación, Matrimonio y Exequias.',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('closed_by_version','V51','verification','functional_equivalent')
where report_key in (
  'rpt_librobautizos','rpt_librobautizospar',
  'rpt_libroconfirma','rpt_libroconfirmapar',
  'rpt_librodifunto','rpt_librodifuntopar',
  'rpt_libromatrimonio','rpt_libromatrimoniopar'
);
update public.legacy_report_definitions
set audit_status='IMPLEMENTADO',
    current_equivalent='ParishOperationalReportsPage + parishOperationalReportPdf',
    gap='Reporte registral moderno por periodo y sacramento con estados realizados, por celebrar, atrasados, decretos/anulaciones, índices e impresiones.',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('closed_by_version','V51','verification','functional_equivalent')
where report_key in (
  'rpt_anulabauti','rpt_anulaconfi','rpt_anuladifun','rpt_anulamatri',
  'rpt_impresas',
  'rpt_bauhechos','rpt_baunohechos','rpt_bauporhacer',
  'rpt_conhechas','rpt_connohechas','rpt_conporhacer',
  'rpt_mathechos','rpt_matnohechos','rpt_matporhacer',
  'rpt_listadifun'
);

-- Documentos cuyo texto histórico completo ya está recuperado y ahora puede emitirse oficialmente.
update public.legacy_report_definitions
set audit_status='IMPLEMENTADO',
    current_equivalent='Centro Documental Eclesial · plantilla histórica versionada + emisión oficial + PDF + archivo',
    gap='Texto legacy preservado y disponible como documento oficial numerado, versionado y auditable.',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('closed_by_version','V52','verification','legacy_template_plus_issuance')
where report_key in (
  'rpt_doc71011','rpt_doc71012','rpt_doc7102','rpt_doc7103','rpt_doc7104','rpt_doc7105',
  'rpt_doc7107','rpt_doc7108','rpt_doc7109','rpt_doc7110','rpt_doc7111','rpt_doc71131','rpt_doc71132',
  'rpt_doc7201','rpt_doc7202','rpt_doc7203','rpt_doc7206-A',
  'rpt_doc7301','rpt_doc7303','rpt_doc7304','rpt_doc7306','rpt_doc7310'
);

update public.legacy_report_definitions
set audit_status='IMPLEMENTADO',
    current_equivalent='Centro Documental Eclesial · MODERN-7206-CAUCIONES + FRX original preservado',
    gap='El cuerpo editable original no sobrevivió en el FRX. Se conserva el diseño histórico y se ofrece una reconstrucción moderna explícitamente diferenciada, basada en las exigencias canónicas aplicables.',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'closed_by_version','V53',
      'verification','modern_reconstruction_with_legacy_provenance',
      'modern_template_code','MODERN-7206-CAUCIONES'
    )
where report_key='rpt_doc7206-B';
