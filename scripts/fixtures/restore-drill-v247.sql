-- V247: datos 100 % ficticios para ensayar respaldo/restauración PostgreSQL.
-- No son las migraciones de SACRAMENTUM ni una copia de Supabase QA.
CREATE TABLE public.fixture_parishes (id text PRIMARY KEY,diocese_id text NOT NULL);
CREATE TABLE public.fixture_registers (
 id text PRIMARY KEY,
 parish_id text NOT NULL REFERENCES public.fixture_parishes(id),
 sacrament text NOT NULL CHECK (sacrament IN ('baptism','confirmation','marriage','funeral')),
 book integer NOT NULL CHECK (book>0),
 folio integer NOT NULL CHECK (folio>0),
 number integer NOT NULL CHECK (number>0),
 state text NOT NULL CHECK (state IN ('seated','corrected','annulled')),
 UNIQUE(parish_id,sacrament,book,folio,number)
);
CREATE TABLE public.fixture_decrees (
 id text PRIMARY KEY,
 register_id text NOT NULL REFERENCES public.fixture_registers(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK (kind IN ('correction','replacement','annulment')),
 status text NOT NULL CHECK (status IN ('active','reversed'))
);
CREATE TABLE public.fixture_documents (
 id text PRIMARY KEY,
 parish_id text NOT NULL REFERENCES public.fixture_parishes(id),
 register_id text NOT NULL REFERENCES public.fixture_registers(id),
 state text NOT NULL CHECK (state IN ('issued','voided'))
);
INSERT INTO public.fixture_parishes(id,diocese_id) VALUES
 ('parish-alpha','diocese-a'),('parish-beta','diocese-a'),('parish-gamma','diocese-b');
INSERT INTO public.fixture_registers(id,parish_id,sacrament,book,folio,number,state) VALUES
 ('B1','parish-alpha','baptism',1,1,1,'seated'),
 ('B2','parish-alpha','baptism',1,1,2,'corrected'),
 ('C1','parish-beta','confirmation',2,1,1,'seated'),
 ('M1','parish-gamma','marriage',3,1,1,'seated'),
 ('F1','parish-gamma','funeral',4,1,1,'seated');
INSERT INTO public.fixture_decrees(id,register_id,kind,status) VALUES
 ('decree-1','B2','correction','active'),
 ('decree-2','C1','replacement','reversed'),
 ('decree-3','M1','annulment','active');
INSERT INTO public.fixture_documents(id,parish_id,register_id,state) VALUES
 ('document-1','parish-alpha','B1','issued'),
 ('document-2','parish-gamma','M1','voided');
CREATE INDEX fixture_registers_parish_idx ON public.fixture_registers(parish_id);
ALTER TABLE public.fixture_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_parish_reader ON public.fixture_registers
 FOR SELECT TO fixture_reader USING (parish_id=current_setting('app.fixture_parish',true));
GRANT USAGE ON SCHEMA public TO fixture_reader;
GRANT SELECT ON public.fixture_registers TO fixture_reader;
