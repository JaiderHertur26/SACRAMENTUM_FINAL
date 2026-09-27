-- SACRAMENTUM V74
-- Revisión editorial profesional de las plantillas documentales del sistema.
-- Conserva versiones previas para auditoría y mantiene códigos, variables y vínculos sacramentales.

create temporary table _v74_document_rewrites(
  code text primary key,
  name text not null,
  template_text text not null
) on commit drop;

insert into _v74_document_rewrites(code,name,template_text) values
('LEGACY-71011','Certificado de soltería — constancia bautismal',$doc$
El suscrito párroco de <Miparroquia> certifica que <Nombres> <Apellidos> se encuentra bautizado(a) en esta parroquia y que su partida de Bautismo está inscrita en el Libro <Libro>, Folio <Folio>, Número <Numero>.

Revisado el registro eclesial correspondiente, a la fecha de expedición no consta en dicha partida anotación marginal de matrimonio canónico.

Se expide la presente certificación a petición del interesado en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71012','Certificado de soltería por declaración de testigos',$doc$
El suscrito párroco de <Miparroquia> certifica que, en fecha <Fecha>, comparecieron ante este despacho parroquial <Testigo1>, identificado(a) con documento No. <Cedula1>, y <Testigo2>, identificado(a) con documento No. <Cedula2>.

Los comparecientes, quienes manifestaron ser <Parentesco1> y <Parentesco2>, respectivamente, declararon bajo juramento que les consta que <Nombres> <Apellidos>, identificado(a) con documento No. <Cedula3>, hijo(a) de <Padres>, no ha contraído matrimonio canónico ni civil según su conocimiento y testimonio.

Para constancia, se expide la presente certificación en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71021','Licencia para celebración de matrimonio',$doc$
El suscrito párroco concede licencia, conforme al c. 1115, para que <Solicitante>, identificado(a) con documento No. <Cedula1>, feligrés de esta parroquia, pueda contraer matrimonio con <Pareja>, identificado(a) con documento No. <Cedula2>, fuera de esta jurisdicción parroquial.

La presente licencia no sustituye el expediente matrimonial ni las demás diligencias canónicas exigidas. Corresponde al párroco o ministro competente que asista al matrimonio verificar el cumplimiento íntegro de los requisitos previstos por el derecho de la Iglesia.

Para constancia, se expide la presente licencia en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71031','Certificado de curso prematrimonial',$doc$
El suscrito párroco de <Miparroquia> certifica que <Novio>, identificado con documento No. <Cedula1>, y <Novia>, identificada con documento No. <Cedula2>, participaron y completaron el curso prematrimonial dispuesto como preparación pastoral para la celebración del sacramento del Matrimonio.

Se expide la presente certificación a petición de los interesados en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71041','Constancia de próximo matrimonio',$doc$
El suscrito párroco de <Miparroquia> certifica que <Novio>, identificado con documento No. <Cedula1>, y <Novia>, identificada con documento No. <Cedula2>, tienen prevista la celebración de su matrimonio en esta parroquia el <Fecmat>.

Asimismo, consta en el expediente que han realizado la preparación prematrimonial correspondiente.

Se expide la presente constancia a petición de los interesados en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71051','Certificado de vecindad y convivencia',$doc$
El suscrito párroco de <Miparroquia> certifica que <Nombre1>, identificado(a) con documento No. <Cedula1>, y <Nombre2>, identificado(a) con documento No. <Cedula2>, forman parte de esta comunidad parroquial y han informado como lugar de residencia la dirección <Direccion>.

Se expide la presente certificación a petición de los interesados en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71061','Certificado de supervivencia',$doc$
El suscrito párroco certifica que, en la fecha de expedición, compareció personalmente ante este despacho <Nombre>, identificado(a) con documento No. <Cedula>, expedido en <Expedido>, con el propósito de acreditar su supervivencia.

Para constancia, se expide la presente certificación en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71071','Certificado negativo de partida',$doc$
El suscrito párroco de <Miparroquia> certifica que, realizada una búsqueda diligente en los libros y archivos parroquiales disponibles, no fue posible localizar la partida de <Tipopartida> correspondiente a <Nombre>.

La presente certificación deja constancia únicamente del resultado de la búsqueda efectuada en este archivo parroquial.

Se expide a petición del interesado en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71081','Constancia de preparación para Bautismo de adulto',$doc$
El suscrito párroco de <Miparroquia> certifica que <Nombre> ha realizado la preparación catequética y pastoral requerida para recibir el sacramento del Bautismo y, conforme corresponda a su proceso de iniciación cristiana, los demás sacramentos previstos por la disciplina de la Iglesia.

La preparación se ha desarrollado teniendo presentes las disposiciones de los cc. 865 y 866.

Se expide la presente constancia a petición del interesado en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71091','Declaración testimonial de adulto no bautizado',$doc$
El suscrito párroco de <Miparroquia> certifica que, en fecha <Fecha>, comparecieron ante este despacho parroquial <Testigo1>, identificado(a) con documento No. <Cedula1>, y <Testigo2>, identificado(a) con documento No. <Cedula2>.

Los comparecientes, quienes manifestaron ser <Parentesco1> y <Parentesco2>, respectivamente, declararon bajo juramento que, según su conocimiento directo, <Nombres>, hijo(a) de <Padres>, no ha recibido el sacramento del Bautismo.

Para constancia de esta declaración testimonial, se expide el presente documento en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71101','Constancia de búsqueda negativa de Bautismo',$doc$
El suscrito párroco de <Miparroquia> hace constar que, realizada una búsqueda diligente en los libros y archivos parroquiales disponibles, no se encontró partida de Bautismo a nombre de <Nombre>.

La presente constancia se limita al archivo de esta parroquia y no constituye por sí sola declaración universal de no bautizado.

Se expide a petición del interesado en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71111','Constancia de preparación para la Confirmación',$doc$
El suscrito párroco de <Miparroquia> certifica que <Nombre> ha realizado la preparación catequética y pastoral prevista para recibir el sacramento de la Confirmación.

Se expide la presente constancia a petición del interesado en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71112','Certificado de Exequias',$doc$
El suscrito párroco de <Miparroquia> certifica que el día <Fechae> se celebraron las exequias eclesiásticas de <Nombres> <Apellidos>, de <Edad>, sexo <Sexo>, cuyo fallecimiento consta con fecha <Fecham>, hijo(a) de <Padres>.

La celebración fue presidida o atendida por <Ministro>.

Para constancia, se expide la presente certificación a petición del interesado en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71131','Certificado de curso prebautismal — padres',$doc$
El suscrito párroco de <Miparroquia> certifica que <Padre>, identificado con documento No. <ccPadre>, y <Madre>, identificada con documento No. <ccMadre>, participaron y completaron la preparación prebautismal destinada a padres de familia.

Se expide la presente certificación a petición de los interesados en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-71132','Certificado de curso prebautismal — padrinos',$doc$
El suscrito párroco de <Miparroquia> certifica que <Padrino>, identificado con documento No. <ccPadrino>, y <Madrina>, identificada con documento No. <ccMadrina>, participaron y completaron la preparación prebautismal destinada a padrinos.

Se expide la presente certificación a petición de los interesados en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-72011','Solicitud de dispensa de proclamas',$doc$
Excelentísimo Señor:

Los señores <Novio> y <Novia> desean contraer matrimonio y, por conducto de esta parroquia, solicitan respetuosamente la dispensa de las proclamas canónicas, teniendo presente lo establecido en el c. 1067 y la normativa particular aplicable.

La petición se fundamenta en las siguientes causas:
1) <Causa1>
2) <Causa2>
3) <Causa3>

Realizadas las diligencias pastorales correspondientes, no se ha advertido impedimento distinto de lo expresamente indicado en el expediente.

Se presenta la solicitud en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-72021','Solicitud de licencia para matrimonio mixto',$doc$
Los señores <Novio> y <Novia> desean contraer matrimonio. Por medio de la presente se solicita la licencia correspondiente para la celebración de matrimonio mixto, conforme a los cc. 1124 y 1125, dado que uno de los contrayentes pertenece a la confesión <Confesion>.

La parte católica ha sido instruida acerca de los compromisos previstos por la disciplina de la Iglesia y se han incorporado al expediente las declaraciones y cauciones correspondientes.

La petición se apoya en las siguientes causas pastorales:
1) <Causa1>
2) <Causa2>
3) <Causa3>

Realizadas las diligencias previstas, no se ha advertido impedimento distinto de lo consignado en el expediente.

Se presenta la solicitud en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-72031','Solicitud de dispensa por edad',$doc$
Excelentísimo Señor:

Los señores <Novio> y <Novia> desean contraer matrimonio y, por conducto de esta parroquia, solicitan la dispensa que corresponda respecto del impedimento de edad, conforme al c. 1083 y a la normativa particular aplicable. En el expediente constan las edades informadas: <Edad1> / <Edad2>.

La petición se fundamenta en las siguientes razones:
1) <Causa1>
2) <Causa2>
3) <Causa3>

Se han realizado las diligencias pastorales pertinentes y se remite la solicitud para la decisión de la autoridad competente.

Dado en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-72061','Solicitud de dispensa por disparidad de culto',$doc$
Los señores <Novio> y <Novia> desean contraer matrimonio y, por conducto de esta parroquia, solicitan la dispensa del impedimento de disparidad de culto conforme al c. 1086, dado que <Contrayente> no ha recibido el Bautismo.

La parte católica ha sido instruida acerca de los compromisos previstos por la disciplina de la Iglesia y se han incorporado al expediente las declaraciones y cauciones correspondientes.

La petición se fundamenta en las siguientes causas pastorales:
1) <Causa1>
2) <Causa2>
3) <Causa3>

Realizadas las diligencias previstas, no se ha advertido impedimento distinto de lo consignado en el expediente.

Se presenta la solicitud en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-73011','Solicitud de partida de Bautismo',$doc$
Respetuosamente solicito la expedición de copia auténtica de la partida de Bautismo de <Nombre>, hijo(a) de <Padres>, nacido(a) el <FecNac> y cuyo Bautismo se ubica, según la información disponible, entre los años <Year1> y <Year2>.

En caso de no localizarse el asiento correspondiente, se solicita informar el resultado de la búsqueda o expedir la certificación negativa que proceda.

La partida se requiere para efectos de <Efecto>.
$doc$),
('LEGACY-73012','Solicitud de partida de Matrimonio',$doc$
Respetuosamente solicito la expedición de copia auténtica de la partida de Matrimonio de <Esposo> y <Esposa>, celebrado según la información disponible el <FecMat>.

En caso de no localizarse el asiento correspondiente, se solicita informar el resultado de la búsqueda o expedir la certificación negativa que proceda.

La partida se requiere para efectos de <Efecto>.
$doc$),
('LEGACY-73013','Solicitud de partida de Confirmación',$doc$
Respetuosamente solicito la expedición de copia auténtica de la partida de Confirmación de <Nombre>, hijo(a) de <Padres>, nacido(a) el <FecNac> y cuya Confirmación se ubica, según la información disponible, entre los años <Year1> y <Year2>.

En caso de no localizarse el asiento correspondiente, se solicita informar el resultado de la búsqueda o expedir la certificación negativa que proceda.

La partida se requiere para efectos de <Efecto>.
$doc$),
('LEGACY-73021','Solicitud de corrección de partida de Bautismo',$doc$
<Solicitante> presenta solicitud de <Labor> respecto de la partida de Bautismo de <Titular>, inscrita en el Libro <Libro>, Folio <Folio>, Número <Numero>.

La solicitud se formula con fundamento en los documentos y elementos probatorios que se adjuntan para estudio de la autoridad eclesiástica competente.

Se suscribe la presente solicitud en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-73022','Solicitud de corrección de partida de Matrimonio',$doc$
<Solicitante> presenta solicitud de <Labor> respecto de la partida de Matrimonio de <Esposo> y <Esposa>, inscrita en el Libro <Libro>, Folio <Folio>, Número <Numero>.

La solicitud se formula con fundamento en los documentos y elementos probatorios que se adjuntan para estudio de la autoridad eclesiástica competente.

Se suscribe la presente solicitud en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-73023','Solicitud de corrección de partida de Confirmación',$doc$
<Solicitante> presenta solicitud de <Labor> respecto de la partida de Confirmación de <Titular>, inscrita en el Libro <Libro>, Folio <Folio>, Número <Numero>.

La solicitud se formula con fundamento en los documentos y elementos probatorios que se adjuntan para estudio de la autoridad eclesiástica competente.

Se suscribe la presente solicitud en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-73031','Constancia de partida de Bautismo incorporada al expediente matrimonial',$doc$
En <Diocesis>, Parroquia <ParroBau>, consta una partida de Bautismo registrada en el Libro <LibroBau>, Folio <FolioBau>, Número <NumeroBau>.

Según el asiento, el Bautismo fue celebrado el <FechaBau> y corresponde a <Solicitante>, nacido(a) el <FechaNac> en <LugarNac>, hijo(a) de <Padres>. Abuelos paternos: <AbuePater>. Abuelos maternos: <AbueMater>. Padrinos: <Padrinos>. Ministro: <Ministro>. Da fe: <DioFe>.

La presente constancia reproduce los datos suministrados por la partida incorporada al expediente matrimonial y se expide el <FechaExp>.
$doc$),
('LEGACY-73041','Solicitud de Bautismo de adulto',$doc$
Yo, <Nombre>, mayor de edad y sujeto a las disposiciones previstas para el Bautismo de adultos, solicito respetuosamente ser admitido(a) a la celebración de los sacramentos de iniciación cristiana que correspondan a mi proceso.

Declaro haber recibido la preparación catequética y pastoral requerida y presento la documentación solicitada por la Iglesia, conforme a las disposiciones aplicables, entre ellas los cc. 852 §1 y 865 §1.

Suscribo la presente solicitud en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-73061','Solicitud de licencia para Bautismo de adulto',$doc$
Excelentísimo Señor:

Respetuosamente se solicita la licencia que corresponda para administrar los sacramentos de iniciación cristiana a <Nombre>, adulto(a) que ha realizado el proceso de preparación y cuya documentación se encuentra incorporada al expediente.

La petición se presenta teniendo presentes las disposiciones aplicables al Bautismo de adultos, especialmente el c. 865 §1.

Se presenta la solicitud en <Miciudad>, el <Fecha>.
$doc$),
('LEGACY-73071','Solicitud de reposición de partida',$doc$
Ante este despacho se ha presentado <Solicitante> solicitando la reposición de la partida de <Partida> correspondiente a <Interesado>.

Como fundamento de la petición se expone lo siguiente: <Motivo>.

La solicitud se acompaña de los documentos, testimonios y demás elementos probatorios aportados para acreditar el hecho sacramental y permitir su estudio por la autoridad eclesiástica competente.

La partida se requiere para efectos de <Efectos>.
$doc$),
('LEGACY-73101','Delegación para asistir al matrimonio',$doc$
El suscrito párroco, <Parroco>, delega al presbítero <Delegado> para asistir, en nombre de la Iglesia, al matrimonio de <ElContrayente> y <LaContrayente>, previsto para el día <FechaMatrimonio> en esta parroquia, conforme a las facultades y disposiciones canónicas aplicables.

Para constancia, se expide la presente delegación en <Miciudad>, el <Fecha>.
$doc$),
('MODERN-7206-CAUCIONES','Cauciones para matrimonio mixto o disparidad de culto',$doc$
En relación con el matrimonio de <ParteCatolica> con <OtraParte>, la parte católica declara que está dispuesta a conservar la fe católica y a evitar cuanto pueda apartarla de ella. Asimismo, promete sinceramente hacer cuanto le sea posible para que los hijos sean bautizados y educados en la Iglesia católica.

La otra parte declara haber sido informada oportunamente de estos compromisos y manifiesta conocer su contenido.

Ambos contrayentes declaran haber recibido instrucción acerca de los fines y propiedades esenciales del matrimonio y manifiestan no excluirlos.

Para constancia, se suscribe la presente declaración en <Miciudad>, el <Fecha>.

Parte católica: <ParteCatolica> · Documento: <DocumentoCatolico>
Otra parte: <OtraParte> · Documento: <DocumentoOtraParte>
$doc$);

-- Crear una nueva versión profesional únicamente a partir de plantillas de sistema activas.
insert into public.document_templates(
  legacy_code,code,name,category,template_text,variables,
  scope_type,diocese_id,parish_id,version,is_active,is_legacy,
  metadata,created_by,created_at,updated_at
)
select
  old.legacy_code,
  old.code,
  rewrite.name,
  old.category,
  trim(rewrite.template_text),
  old.variables,
  old.scope_type,
  old.diocese_id,
  old.parish_id,
  old.version + 1,
  true,
  false,
  coalesce(old.metadata,'{}'::jsonb) || jsonb_build_object(
    'quality_tier','professional_ecclesial',
    'editorial_review','V74',
    'previous_template_id',old.id,
    'previous_version',old.version,
    'legacy_text_preserved_in_history',true
  ),
  old.created_by,
  now(),
  now()
from public.document_templates old
join _v74_document_rewrites rewrite on upper(rewrite.code)=upper(old.code)
where old.is_active=true
  and old.scope_type='system';

-- Desactivar solamente las versiones anteriores, nunca las nuevas V74.
update public.document_templates old
set is_active=false,
    updated_at=now()
where old.is_active=true
  and old.scope_type='system'
  and exists(select 1 from _v74_document_rewrites r where upper(r.code)=upper(old.code))
  and coalesce(old.metadata->>'editorial_review','') <> 'V74';

-- Dejar trazabilidad global de la revisión editorial.
comment on table public.document_templates
is 'Plantillas documentales versionadas; desde V74 las plantillas base del sistema usan redacción profesional eclesial y conservan sus versiones heredadas para auditoría.';
