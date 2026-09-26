-- SACRAMENTUM V46 · Biblioteca documental legacy real
-- Fuente: CERTIFICADOS.json de SACRAMENTA PLUS.
-- Preserva texto histórico como plantilla de sistema versionable; no altera documentos ya emitidos.

alter function public.save_document_template(
  text,text,text,text,text,uuid,uuid,jsonb
) set search_path = '';

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71011','LEGACY-71011','Certificado Soltería Bautizados en esta Parroquia','certificate','El suscrito cura párroco de <Miparroquia>, certifica que <Nombres> <Apellidos>, se encuentra bautizado en esta parroquia, que su partida de bautismo está registrada en el libro <Libro>, folio <Folio> y número <Numero> y que hasta la fecha no presenta reportado ningún vínculo canónico vigente.

Se expide el presente certificado a petición del interesado en <Miciudad>, el <Fecha>.',
  array['Miparroquia','Nombres','Apellidos','Libro','Folio','Numero','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71011',
    'legacy_description','Certificado Soltería Bautizados en esta Parroquia',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71011'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71012','LEGACY-71012','Certificado Soltería Testificado','certificate','El suscrito párroco de <Miparroquia> certifica que el día <Fecha>, se presentaron al despacho parroquial <Testigo1>, documento de identidad No. <Cedula1> y <Testigo2>, documento de identidad No. <Cedula2>, quienes bajo la gravedad del juramento, DECLARARON que, por ser <Parentesco1> y <Parentesco2>, respectivamente, les consta que <Nombres> <Apellidos>, identificado con C. C. No. <Cedula3>, hijo de <Padres>, no ha contraido matrimonio ni eclesiástica ni civilmente hasta la fecha.

Para constancia se firma la presente certificación en <Miciudad> el <Fecha>.',
  array['Miparroquia','Fecha','Testigo1','Cedula1','Testigo2','Cedula2','Parentesco1','Parentesco2','Nombres','Apellidos','Cedula3','Padres','Miciudad']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71012',
    'legacy_description','Certificado Soltería Testificado',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71012'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71021','LEGACY-71021','Permiso Matrimonial','permission','El suscrito, concede licencia para contraer matrimonio en su parroquia (c.1115), a <Solicitante>, identificado con c.c. No. <Cedula1>, feligrés de esta Parroquia  con  <Pareja>, c.c. No. <Cedula2>.  Se advierte  que  no  se  ha  hecho ninguna diligencia previa a este matrimonio, quedando por lo tanto, bajo la responsabilidad del párroco que presencie o delegue la celebración del mismo, salvaguardar las normas del derecho durante  todo el proceso, ya que esta licencia no exonera de los demás requisitos legales.

Para constancia de lo anterior se firma la presente licencia en <Miciudad> el <Fecha>',
  array['Solicitante','Cedula1','Pareja','Cedula2','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71021',
    'legacy_description','Permiso Matrimonial',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71021'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71031','LEGACY-71031','Curso Pre-Matrimonial','formation_certificate','El suscrito Párroco de <Miparroquia> certifica que: <Novio> con c.c. # <Cedula1> y <Novia> con c.c. # <Cedula2> Realizaron el CURSO PRE_MATRIMONIAL y se han preparado para vivir en unión bajo el sagrado vínculo del matrimonio.

Se expide este certificado a petición del interesado en <Miciudad> el <Fecha>',
  array['Miparroquia','Novio','Cedula1','Novia','Cedula2','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71031',
    'legacy_description','Curso Pre-Matrimonial',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71031'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71041','LEGACY-71041','Constancia Pronto Matrimonio','certificate','El suscrito Párroco de <Miparroquia> certifica: Que los señores <Novio> con c.c. # <Cedula1> y <Novia> con c.c. # <Cedula2>, contraerán Matrimonio en esta parroquia el <Fecmat>, realizaron el CURSO PRE-MATRIMONIAL y se han preparado para vivir en unión bajo el sagrado vínculo del matrimonio.

Se expide este certificado a petición del interesado en <Miciudad> el <Fecha>',
  array['Miparroquia','Novio','Cedula1','Novia','Cedula2','Fecmat','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71041',
    'legacy_description','Constancia Pronto Matrimonio',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71041'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71051','LEGACY-71051','Certificado de Vecindad y Convivencia','certificate','El suscrito párroco de <Miparroquia> certifica que <Nombre1> con c.c. # <Cedula1> y <Nombre2> con c.c. # <Cedula2>, hacen parte de la comunidad parroquial y están residenciados en esta Parroquia en la siguiente dirección: <Direccion>.

Se expide este certificado a petición del interesado en <Miciudad> el <Fecha>',
  array['Miparroquia','Nombre1','Cedula1','Nombre2','Cedula2','Direccion','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71051',
    'legacy_description','Certificado de Vecindad y Convivencia',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71051'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71061','LEGACY-71061','Certificado de Supervivencia','certificate','El suscrito párroco hace constar que en la fecha compareció a este despacho <Nombre> quien se identificó con el documento de identidad No. <Cedula> expedido en <Expedido> con la finalidad de demostrar su SUPERVIVENCIA. En constancia de lo anterior se toma su huella dactilar del indice derecho.

Se expide este certificado a petición del interesado en <Miciudad> el <Fecha>',
  array['Nombre','Cedula','Expedido','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71061',
    'legacy_description','Certificado de Supervivencia',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71061'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71071','LEGACY-71071','Certificado Negativo','certificate','El suscrito Párroco de <Miparroquia>, certifica que se ha buscado diligentemente la partida de <Tipopartida> de <Nombre> y no ha sido posible encontrarla en el archivo parroquial.

Se expide este certificado a petición del interesado en <Miciudad> el <Fecha>',
  array['Miparroquia','Tipopartida','Nombre','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71071',
    'legacy_description','Certificado Negativo',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71071'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71081','LEGACY-71081','Preparación Bautismo Adulto','legacy_document','El suscrito Párroco de <Miparroquia>, certifica que <Nombre>, ha recibido la adecuada preparación para recibir el Sacramento del Bautismo, así mismo ha sido preparado para recibir los Sacramentos de la Sagrada Eucaristía y de la Confirmación. (Canon 865 y 866).

Se expide la presente certificación a petición del interesado en <Miciudad> el <Fecha>.',
  array['Miparroquia','Nombre','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71081',
    'legacy_description','Preparación Bautismo Adulto',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71081'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71091','LEGACY-71091','Declaración Adulto no Bautizado','legacy_document','El suscrito párroco de <Miparroquia> certifica que el día <Fecha>, se presentaron al despacho parroquial <Testigo1>, documento de identidad No. <Cedula1> y <Testigo2>, documento de identidad No. <Cedula2>, quienes bajo la gravedad del juramento, DECLARARON que, por ser <Parentesco1> y <Parentesco2>, respectivamente, les consta que <Nombres>, hijo de <Padres>, no ha recibido el sacramento del bautismo hasta la fecha.

Para constancia se firma la presente certificación en <Miciudad> el <Fecha>.',
  array['Miparroquia','Fecha','Testigo1','Cedula1','Testigo2','Cedula2','Parentesco1','Parentesco2','Nombres','Padres','Miciudad']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71091',
    'legacy_description','Declaración Adulto no Bautizado',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71091'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71101','LEGACY-71101','Constancia de no Bautizado','certificate','El suscrito Párroco de <Miparroquia>, hace constar que en los archivos parroquiales no reposa partida de bautismo a nombre de <Nombre>, feligrés de esta parroquia.

Se expide la presente constancia a petición del interesado en <Miciudad> el <Fecha>.',
  array['Miparroquia','Nombre','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71101',
    'legacy_description','Constancia de no Bautizado',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71101'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71111','LEGACY-71111','Preparación para la Confirmación','legacy_document','El suscrito Párroco de <Miparroquia>, certifica que <Nombre>, ha recibido la adecuada preparación para recibir el Sacramento de la Confirmación.

Se expide la presente certificación a petición del interesado en <Miciudad> el <Fecha>.',
  array['Miparroquia','Nombre','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71111',
    'legacy_description','Preparación para la Confirmación',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71111'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71112','LEGACY-71112','Certificado de Exequias','certificate','El suscrito párroco de <Miparroquia> certifica que el día <Fechae>, se realizaron las exequias de <Nombres> <Apellidos>,  de <Edad> y sexo <Sexo> muerto el dia <Fecham>, hijo(a) de <Padres>. Ministro: <Ministro>

Para constancia se firma la presente certificación a petición del interesado en <Miciudad> el <Fecha>.',
  array['Miparroquia','Fechae','Nombres','Apellidos','Edad','Sexo','Fecham','Padres','Ministro','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71112',
    'legacy_description','Certificado de Exequias',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71112'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '72011','LEGACY-72011','Dispensa de Proclamas','dispensation','Excmo. SR.
Los  Señores:  <Novio> y <Novia>, desean contraer matrimonio en esta parroquia, y por mi conducto solicitan la dispensa de las PROCLAMAS CANONICAS (c.1067), en atención a las siguientes causas.
	1) <Causa1>.
	2) <Causa2>.
	3) <Causa3>.
Se realizó la información verbal y no se encontró ningún impedimento. Dado en <Miciudad> el <Fecha>.',
  array['Novio','Novia','Causa1','Causa2','Causa3','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','72011',
    'legacy_description','Dispensa de Proclamas',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-72011'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '72021','LEGACY-72021','Dispensa Mixta Religión','dispensation','Los  Señores: <Novio> y <Novia>, desean contraer matrimonio en esta Parroquia. Me permito solicitar licencia para presenciar este matrimonio a tenor de los canones 1124 y 1125 ya que uno de los contrayentes está bautizado en la confesión <Confesion>. La parte católica se compromete a cumplir la recomendación de la Iglesia para estos casos. Se solicita igualmente la Dispensa de las Proclamas Canónicas todo en atención a las siguiente causas.
	1) <Causa1>.
	2) <Causa2>.
	3) <Causa3>.
Se realizó la información verbal y no se encontró ningún impedimento. Dado en <Miciudad> el <Fecha>.',
  array['Novio','Novia','Confesion','Causa1','Causa2','Causa3','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','72021',
    'legacy_description','Dispensa Mixta Religión',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-72021'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '72031','LEGACY-72031','Dispensa de Edad','dispensation','Excmo. SR.
Los  Señores:  <Novio> y <Novia>, desean contraer matrimonio en esta parroquia, y por mi conducto solicitan la dispensa de la edad (c. 1083), (<Edad1> / <Edad2>) que le hace falta a los contrayentes para los 18 años, ordenada por la CONFERENCIA EPISCOPAL, y fundamentan su petición en las siguientes razones:
	1) <Causa1>.
	2) <Causa2>.
	3) <Causa3>.
Se realizó la información verbal y no se encontró ningún impedimento. Dado en <Miciudad> el <Fecha>.',
  array['Novio','Novia','Edad1','Edad2','Causa1','Causa2','Causa3','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','72031',
    'legacy_description','Dispensa de Edad',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-72031'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '72061','LEGACY-72061','Dispensa Disparidad de Cultos','dispensation','Los  Señores: <Novio> y <Novia>, desean contraer matrimonio y por mi conducto solicitan la DISPENSA DEL IMPEDIMENTO DE DISPARIDAD DE CULTOS (c.1086), ya que <Contrayente> no ha recibido el sacramento del Bautismo y no manifiesta deseos de recibirlo. La parte católica se compromete a cumplir las recomendaciones de la Iglesia para estos casos. Se solicita igualmente la dispensa de las proclamas canónicas. Todo esto en atención a las siguientes causas:
	1) <Causa1>.
	2) <Causa2>.
	3) <Causa3>.
Se realizó la informacion verbal y no se encontró ningún impedimento. Dado en <Miciudad> el <Fecha>.',
  array['Novio','Novia','Contrayente','Causa1','Causa2','Causa3','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','72061',
    'legacy_description','Dispensa Disparidad de Cultos',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-72061'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '73011','LEGACY-73011','Solicitud de Partida - Bautismo','request','Atentamente ruego a Usted se sirva expedir copia auténtica o certificado negativo, si es el caso, de la partida de BAUTISMO de <Nombre>,  hijo de <Padres>, nacido el <FecNac> y bautizado(a) en su Parroquia entre los años <Year1> y <Year2>. Es urgente para efectos <Efecto>.

Se envían los aranceles correspondientes y el costo del correo.',
  array['Nombre','Padres','FecNac','Year1','Year2','Efecto']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','73011',
    'legacy_description','Solicitud de Partida - Bautismo',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-73011'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '73012','LEGACY-73012','Solicitud de Partida - Matrimonio','request','Atentamente  ruego  a Usted se sirva expedir copia auténtica o certificado negativo, si es el caso, de la partida de MATRIMONIO de <Esposo> casado en su Parroquia con <Esposa> el <FecMat>. Es urgente para efectos <Efecto>.

Se envían los aranceles correspondientes y el costo del correo.',
  array['Esposo','Esposa','FecMat','Efecto']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','73012',
    'legacy_description','Solicitud de Partida - Matrimonio',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-73012'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '73013','LEGACY-73013','Solicitud de Partida - Confirmación','request','Atentamente ruego a Usted se sirva expedir copia auténtica o certificado negativo, si es el caso, de la partida de CONFIRMACION de <Nombre>,  hijo de <Padres>, nacido el <FecNac> y confirmado(a) en su Parroquia entre los años <Year1> y <Year2>. Es urgente para efectos <Efecto>.

Se envían los aranceles correspondientes y el costo del correo.',
  array['Nombre','Padres','FecNac','Year1','Year2','Efecto']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','73013',
    'legacy_description','Solicitud de Partida - Confirmación',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-73013'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '73021','LEGACY-73021','Corrección de Partidas - Bautismo','correction_request','<Solicitante> solicita la <Labor> de la partida de BAUTISMO de <Titular>, inscrita en el Libro: <Libro>, Folio: <Folio> y Número: <Numero>, de acuerdo a los documentos adjuntos. Se expide la presente solicitud en <Miciudad> el <Fecha>.',
  array['Solicitante','Labor','Titular','Libro','Folio','Numero','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','73021',
    'legacy_description','Corrección de Partidas - Bautismo',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-73021'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '73022','LEGACY-73022','Corrección de Partidas - Matrimonio','correction_request','<Solicitante> solicita la <Labor> de la partida de MATRIMONIO de <Esposo> con <Esposa>, inscrito en el Libro: <Libro>, Folio: <Folio> y Número: <Numero>, de acuerdo a los documentos adjuntos. Se expide la presente solicitud en <Miciudad> el <Fecha>.',
  array['Solicitante','Labor','Esposo','Esposa','Libro','Folio','Numero','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','73022',
    'legacy_description','Corrección de Partidas - Matrimonio',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-73022'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '73023','LEGACY-73023','Corrección de Partidas - Confirmación','correction_request','<Solicitante> solicita la <Labor> de la partida de CONFIRMACION de <Titular>, inscrita en el Libro: <Libro>, Folio: <Folio> y Número: <Numero>, de acuerdo a los documentos adjuntos. Se expide la presente solicitud en <Miciudad> el <Fecha>.',
  array['Solicitante','Labor','Titular','Libro','Folio','Numero','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','73023',
    'legacy_description','Corrección de Partidas - Confirmación',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-73023'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '73031','LEGACY-73031','Partida Existente en Expediente Matrimonial','legacy_document','"<Diocesis>, Parroquia <ParroBau>, LIBRO: <LibroBau> FOLIO: <FolioBau> NUMERO: <NumeroBau>. A <FechaBau>, fue <TipoSexo> a quien se llamó <Solicitante>, nació el <FechaNac> en <LugarNac>. Hijo de: <Padres>. Abuelos paternos: <AbuePater>. Abuelos maternos:  <AbueMater>. Padrinos: <Padrinos>. Ministro: <Ministro>, Doy  fe.(fdo) <DioFe>. Es fiel copia expedida el <FechaExp>"',
  array['Diocesis','ParroBau','LibroBau','FolioBau','NumeroBau','FechaBau','TipoSexo','Solicitante','FechaNac','LugarNac','Padres','AbuePater','AbueMater','Padrinos','Ministro','DioFe','FechaExp']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','73031',
    'legacy_description','Partida Existente en Expediente Matrimonial',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-73031'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '73041','LEGACY-73041','Solicitud de Bautismo para Adultos','request','Yo, <Nombre>, mayor de edad (Canon 852, parágrafo 1), muy respetuosamente solicito recibir los Sacramentos de Iniciación Cristiana. Presento los documentos requeridos y manifiesto que me preparé convenientemente para recibir estos sacramentos de acuerdo a las exigencias de la Iglesia (Canon 865, parágrafo 1).

Hago esta solicitud en <Miciudad> el <Fecha>',
  array['Nombre','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','73041',
    'legacy_description','Solicitud de Bautismo para Adultos',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-73041'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '73061','LEGACY-73061','Permiso para Bautizar Adulto','permission','Excmo. señor, muy respetuosamente solicito licencia para administrar los Sacramentos de Iniciación Cristiana a <Nombre>. Adjunto los documentos requeridos de acuerdo a las exigencias de la Iglesia (Canon 865, parágrafo 1).

Hago esta solicitud en <Miciudad> el <Fecha>',
  array['Nombre','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','73061',
    'legacy_description','Permiso para Bautizar Adulto',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-73061'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '73071','LEGACY-73071','Reposición de Partidas','replacement_request','A  este  despacho  se  ha  presentado <Solicitante> en solicitud de la partida de <Partida> de <Interesado>. <Motivo>. Por lo anterior solicita la reposición de la misma con base en las declaraciones juramentadas de dos testigos (c.876). La partida es solicitada para efectos <Efectos>.',
  array['Solicitante','Partida','Interesado','Motivo','Efectos']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','73071',
    'legacy_description','Reposición de Partidas',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-73071'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '73101','LEGACY-73101','Delegación para asistencia de matrimonio','permission','El suscrito párroco <Parroco>, delega para la asistencia del sacramento del matrimonio de <ElContrayente> con <LaContrayente>,  al padre <Delegado>. Matrimonio que se celebrará en esta parroquia el día <FechaMatrimonio>

Para constancia de lo anterior se firma el presente documento en <Miciudad> el <Fecha>',
  array['Parroco','ElContrayente','LaContrayente','Delegado','FechaMatrimonio','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','73101',
    'legacy_description','Delegación para asistencia de matrimonio',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-73101'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71131','LEGACY-71131','Curso Prebautismal Padres','formation_certificate','El suscrito Párroco de <Miparroquia>, certifica que <Padre> con C.C. # <ccPadre> y <Madre> con C.C. # <ccMadre>, realizaron el CURSO PRE_ BAUTISMAL PARA PADRES y se han preparado para cumplir con el sacramento de su Hijo. 

Se expide la presente certificación a petición del interesado en <Miciudad> el <Fecha>.',
  array['Miparroquia','Padre','ccPadre','Madre','ccMadre','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71131',
    'legacy_description','Curso Prebautismal Padres',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71131'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,metadata
)
select
  '71132','LEGACY-71132','Curso Prebautismal Padrinos','formation_certificate','El suscrito Párroco de <Miparroquia>, certifica que <Padrino> con C.C. # <ccPadrino> y <Madrina> con C.C. # <ccMadrina>, realizaron el CURSO PRE_ BAUTISMAL PARA PADRINOS y se han preparado para cumplir con el sacramento de su ahijado (a). 

Se expide la presente certificación a petición del interesado en <Miciudad> el <Fecha>.',
  array['Miparroquia','Padrino','ccPadrino','Madrina','ccMadrina','Miciudad','Fecha']::text[],
  'system',null,null,1,true,true,
  jsonb_build_object(
    'source_system','SACRAMENTA_PLUS',
    'source_table','CERTIFICADOS',
    'legacy_code','71132',
    'legacy_description','Curso Prebautismal Padrinos',
    'provenance','D:/dbf_convert/json/CERTIFICADOS.json',
    'review_status','legacy_text_preserved',
    'imported_by_migration','V46'
  )
where not exists (
  select 1 from public.document_templates d
  where d.code='LEGACY-71132'
    and d.scope_type='system'
    and d.diocese_id is null
    and d.parish_id is null
    and d.version=1
);

comment on table public.document_templates is
'Plantillas documentales versionadas. Las filas is_legacy=true preservan redacción histórica y pueden evolucionar mediante nuevas versiones sin borrar el original.';
