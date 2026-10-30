-- V321: la numeración compartida es operación interna del emisor V277.
-- No puede consumirse el consecutivo por un RPC independiente desde el cliente.
REVOKE EXECUTE ON FUNCTION public.next_sacramental_case_sequence_v318(uuid,text) FROM authenticated;
