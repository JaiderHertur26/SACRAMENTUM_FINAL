-- V203 independent, read-only post-timeout residue check.
-- Expected every column is zero after canceled transactions and successful control replays.
SELECT
 (SELECT count(*) FROM public.baptisms WHERE book_number='9885') AS baptism_partidas,
 (SELECT count(*) FROM public.confirmations WHERE book_number='9885') AS confirmation_partidas,
 (SELECT count(*) FROM public.marriages WHERE book_number='9885') AS marriage_partidas,
 (SELECT count(*) FROM public.funerals WHERE book_number='9885') AS funeral_partidas,
 (SELECT count(*) FROM public.pending_baptisms WHERE raw_data->>'qa_v203'='timeout-baptism') AS baptism_pending,
 (SELECT count(*) FROM public.pending_confirmations WHERE raw_data->>'qa_v203'='timeout-confirmation') AS confirmation_pending,
 (SELECT count(*) FROM public.pending_marriages WHERE raw_data->>'qa_v203'='timeout-marriage') AS marriage_pending,
 (SELECT count(*) FROM public.pending_funerals WHERE raw_data->>'qa_v203'='timeout-funeral') AS funeral_pending,
 (SELECT count(*) FROM public.parish_parameters WHERE
    bautizos_params->>'ordinarioLibro'='9885'
    OR confirmaciones_params->>'ordinarioLibro'='9885'
    OR matrimonios_params->>'ordinarioLibro'='9885'
    OR exequias_params->>'ordinarioLibro'='9885') AS parameter_rows,
 (SELECT count(*) FROM public.registry_audit_log
    WHERE after_data->>'qa_v203' IN('timeout-baptism','timeout-confirmation',
       'timeout-marriage','timeout-funeral')) AS audit_rows;
