-- Amplía el fixture V325 para verificar asientos válidos de los cuatro módulos.
ALTER TABLE public.parish_parameters ADD COLUMN exequias_params jsonb DEFAULT '{}';
ALTER TABLE public.pending_marriages ADD COLUMN hora time, ADD COLUMN updated_at timestamptz;
ALTER TABLE public.pending_funerals ADD COLUMN fecha_exequias date, ADD COLUMN hora time, ADD COLUMN updated_at timestamptz;
CREATE TABLE public.confirmations(LIKE public.baptisms INCLUDING DEFAULTS, fecha_bautismo date);
ALTER TABLE public.confirmations ALTER COLUMN hora_sacramento TYPE time USING hora_sacramento::time;
CREATE TABLE public.marriages(
  id uuid DEFAULT gen_random_uuid(), parish_id uuid, celebration_date date,
  book_number text, folio text, number text, observations text, status text, raw_data jsonb, book_type text
);
CREATE TABLE public.funerals(
  id uuid DEFAULT gen_random_uuid(), parish_id uuid, book_number text,
  folio text, number text, numero_registro text, book_type text, status text,
  nombres text, apellidos text, document_id text, sexo text, fecha_nacimiento date,
  lugar_nacimiento text, fecha_defuncion date, lugar_defuncion text, fecha_exequias date,
  hora_exequias time, lugar_exequias text, cementerio text, causa_muerte text,
  nombre_padre text, nombre_madre text, conyuge text, ministro text, da_fe text,
  observations text, nota_marginal text, raw_data jsonb
);
CREATE FUNCTION public.sacramentum_default_marriage_params() RETURNS jsonb LANGUAGE sql AS $$ SELECT public.sacramentum_default_baptism_params() $$;
CREATE FUNCTION public.sacramentum_default_funeral_params() RETURNS jsonb LANGUAGE sql AS $$ SELECT public.sacramentum_default_baptism_params() $$;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.seat_baptism_records(uuid,jsonb,integer,integer,integer), public.seat_confirmation_records(uuid,jsonb,integer,integer,integer), public.seat_pending_marriage(uuid), public.seat_funeral_record(jsonb,uuid) TO authenticated;
