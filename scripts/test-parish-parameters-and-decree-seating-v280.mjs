import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const issue=read('scripts/v280-issue-chancery-decree.sql');
const seat=read('scripts/v280-seat-chancery-decree.sql');
const context=read('scripts/v280b-decree-screen-context.sql');
const diocese=read('scripts/v282-diocese-new-seat-concept-approval.sql');
const kernel=read('scripts/v281-repair-real-ledger-kernel.sql');
const params=read('scripts/v279-parish-parameters-readonly-counter.sql');
const page=read('src/pages/parish/ParishDecreeDetailPage.jsx');
const chancery=read('src/pages/chancery/SacramentalDecreesCenterPage.jsx');
const diocesan=read('src/pages/diocese/DiocesanDecreeOversightPage.jsx');

test('V279 Parámetros es solo SELECT, contador RPC exclusivo',()=>{
 assert.match(params,/REVOKE INSERT, UPDATE, DELETE, TRUNCATE/);
 assert.match(params,/GRANT EXECUTE ON FUNCTION public\.update_parish_boleta_counter_v256/);
 assert.match(params,/FROM PUBLIC,anon;/);
 assert.doesNotMatch(params,/TRUNCATE\s+TABLE/i);
});
test('V281 kernel real es la copia controlada V253 y protegido de clientes',()=>{
 assert.match(kernel,/CREATE FUNCTION sacramentum_ledger\.append_verified_batch_v281/);
 assert.match(kernel,/ORDER BY\s*\(value->>'celebration_date'\)::date/);
 assert.match(kernel,/m\.partidas_per_folio/);
 assert.match(kernel,/CREATE FUNCTION sacramentum_ledger\.append_verified_batch_v281[\s\S]*?SECURITY INVOKER/);
 assert.match(kernel,/REVOKE ALL ON FUNCTION sacramentum_ledger\.append_verified_batch_v281/);
 assert.match(kernel,/EXECUTE modified/);
 assert.doesNotMatch(kernel,/^\s*TRUNCATE\s+TABLE/m);
});
test('V280 emisión exclusivamente Cancillería y sin Libro-Folio-Número',()=>{
 assert.match(issue,/up\.role='chancery'/);
 assert.match(issue,/recordOrigin','chancery_pending_seat_v280'/);
 assert.match(issue,/seatBook',null,'seatFolio',null,'seatNumber',null/);
 assert.match(issue,/INSERT INTO public\.official_notifications/);
 assert.match(issue,/pending_creation_requests/);
 assert.match(issue,/supplementary_concept_approvals_v272/);
 assert.doesNotMatch(issue,/INSERT INTO public\.baptisms/);
});
test('V280 Corrección y Reposición tienen efectos jurídicos distintos',()=>{
 assert.match(issue,/p_decree_type='correccion'/);
 assert.match(issue,/v_effect:=CASE WHEN p_decree_type='correccion' THEN 'annul_and_create' ELSE 'create_only' END/);
 assert.match(seat,/IF effect='annul_and_create' THEN/);
 assert.match(seat,/SET status=''anulada''/);
 assert.match(seat,/marginal_notes/);
});
test('V280 bloqueo obligatorio por fecha y recepción con cerrojo de parroquia',()=>{
 assert.match(seat,/FROM public\.parishes WHERE id=p FOR UPDATE/);
 assert.match(seat,/ORDER BY q\.decree_date ASC,no\.created_at ASC,q\.id ASC LIMIT 1/);
 assert.match(seat,/prior IS DISTINCT FROM d\.id/);
 assert.match(seat,/decreto anterior pendiente/);
 assert.match(seat,/notice\.status<>'read'/);
});
test('V280 capacidad fija, versión y posición obligatoria del servidor',()=>{
 assert.match(seat,/book\.partidas_per_folio IS DISTINCT FROM p_partidas_per_folio/);
 assert.match(seat,/book\.restart_partida_each_folio IS DISTINCT FROM p_restart_number_each_folio/);
 assert.match(seat,/book\.version<>p_expected_version/);
 assert.match(seat,/real_seat_v263\(/);
 assert.match(seat,/p_folio,p_number,p_operation_id/);
});
test('V280 asiento y anulación son atómicos, con copia chancery',()=>{
 assert.match(seat,/UPDATE public\.decretos SET replacement_record_id=rec/);
 assert.match(seat,/INSERT INTO sacramentum_ledger\.chancery_decree_receipts_v280/);
 assert.match(seat,/UPDATE public\.official_notifications/);
 assert.match(seat,/INSERT INTO sacramentum_ledger\.decree_seat_receipts_v280/);
 assert.match(seat,/COMMIT;/);
});
test('V280 histórico se preserva y no reutiliza asiento de pruebas',()=>{
 assert.match(issue,/historic\|legacy\|import/);
 assert.match(issue,/pending_creation_requests/);
 assert.match(seat,/chancery_pending_seat_v280/);
 assert.match(seat,/decree_seat_receipts_v280/);
});
test('V282 aprobación diocesana independiente, conceptos de corrección y reposición',()=>{
 assert.match(diocese,/up\.role='diocese'/);
 assert.match(diocese,/porcorreccion/);
 assert.match(diocese,/porreposicion/);
 assert.match(diocese,/authorization_reference/);
});
test('V280 pantallas enlazadas a decreto, Cancillería y Diócesis',()=>{
 assert.match(page,/ParishDecreeSeatPanelV280/);
 assert.match(page,/seatStatus!=='seated'/); // V295: vista previa disponible; impresión sujeta al asiento
 assert.match(chancery,/ChanceryDecreeIssueV280/);
 assert.match(chancery,/ChanceryDecreeSeatReceiptsV280/);
 assert.doesNotMatch(diocesan,/DiocesanNewDecreeConceptApprovalV282/); // V293: autorización propia de Cancillería
 assert.match(context,/CREATE FUNCTION public\.get_parish_decree_books_v280/);
});
