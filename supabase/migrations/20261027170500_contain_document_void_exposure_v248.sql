-- V248: Contencion temporal de la enumeracion de documentos por usuarios autenticados.
-- Los administradores deben usar solo procedimientos autorizados y auditados.
-- No altera ni elimina partidas, documentos, usuarios ni definiciones de funciones.
-- No reponer EXECUTE hasta aplicar V246 y aprobar los ensayos SQL de jurisdiccion.
REVOKE EXECUTE ON FUNCTION public.void_document_issuance(uuid,text) FROM authenticated;