# SACRAMENTUM · Intervención Cancillería y Decretos V88
Corte: 21 de octubre de 2026 (Colombia)
Código canónico: `C:\SACRAMENTUM\SACRAMENTUM_FINAL`
Repositorio: https://github.com/JaiderHertur26/SACRAMENTUM_FINAL
Base conectada: Supabase / REGISTRO SACRAMENTOS / `foczofcmwampjvlfbsqn`

## Qué representa V88
Actualización incremental de la base V87; **no sustituye** los RPC registrales existentes de corrección/reposición de Bautismo, Confirmación, Matrimonio y Exequias.
Añade decretos documentales (sin modificación de partida) y recuperación de antecedentes documentales históricos en el mismo archivo compartido por Cancillería y su parroquia.

## Reglas institucionales
- **Cancillería**: expide decretos documentales nuevos, registra antecedentes históricos con fuente, y conserva sus rutas existentes de corrección/reposición y reversión autorizada.
- **Parroquia**: recibe inmediatamente el mismo decreto mediante RLS por `parish_id`; consulta/imprime; nunca emite ni revierte. Las partidas se afectan solamente en los flujos registrales correspondientes.
- **Diócesis**: nueva pantalla `/diocese/decretos/archivo`, consulta de su jurisdicción sin botones de emisión ni reversión.
- **Administrador General**: puede auditar datos según política global actual. La RPC de emisión documental rechaza explícitamente su rol.
- **Nulidad matrimonial**: el decreto del Tribunal no se emite como corrección/reposición de Cancillería; antecedente diferenciado.

## Operaciones y efecto sobre partida
| Acto | Documento | Partida |
| --- | --- | --- |
| Corrección nueva | Decreto en ambos archivos | La RPC específica valida y vincula original + supletoria |
| Reposición nueva | Decreto en ambos archivos | La RPC específica crea supletoria |
| Corrección histórica conciliada desde ANULACION.DBF | Mismo decreto histórico en ambos archivos | Mantiene anulación original y nueva enlazada; sin nueva ejecución |
| Histórica pendiente de validar | Antecedente en archivo; marcado histórico | No asumir/crear una modificación no probada |
| Decreto documental nuevo | Documento impreso en ambos archivos | Ninguna modificación |
| Decreto documental antiguo | Reconstrucción señalizada y fuente original | Ninguna modificación |
| Nulidad de Tribunal | Antecedente distinguido | No equiparar con corrección ni aplicar acciones de Cancillería |

Los decretos nuevos e históricos están en la tabla canónica `public.decretos`. La parroquia correspondiente se relaciona por `parish_id`, la Diócesis por `diocese_id`, la institución emisora por `chancery_id`. En documentos históricos se mantiene aviso de que la reconstrucción no constituye nueva emisión ni prueba de ejecución.

## Cambios funcionales
- Cancillería: `/chancery/decretos/documental` para emitir documentos nuevos; `?mode=historico` selecciona directamente recuperación de antecedente.
- Cancillería: archivo `/chancery/decretos/archivo` incluye contenedores históricos y modalidades documentales; consulta directa por jurisdicción, no solo por parroquias operativas. Paginación de 500 hasta 100 000 entradas, sin límite de primera página.
- Parroquia: `/parroquia/decretos/archivo` ofrece filtro documental y detalles; `/parish/decrees/:decreeId` imprime la representación documental específica con texto escapado.
- Diócesis: nueva pantalla de supervisión `/diocese/decretos/archivo`; menú lateral.
- Modelo único para clase de decreto, origen histórico, posible afectación registral y prevención de reversión sobre precedentes históricos o actos documentales.

## Seguridad de base de datos
Aplicadas y verificadas **en Supabase**:
1. `chancery_documentary_decrees_v88`: RPC `public.issue_documentary_decree_v88`. Exclusiva para rol chancery con jurisdicción obtenida del perfil del servidor; verifica parroquia, fecha, número, expediente, fundamento y fuente si histórica. Conserva auditoría; no toca `baptisms`, `confirmations`, `marriages`, `funerals`.
2. `guard_historical_decree_identity_v88`: trigger `private.guard_legacy_decree_identity_v88` contra apropiación accidental de un número de decreto y cambio de vínculos de original/supletoria de ANULACION.DBF. Colisiones requieren revisión del lote de importación.

Se confirmó: RPC accesible a `authenticated` y denegada a `anon`. RLS de `decretos` mantiene SELECT jurisdiccional por `can_access_parish`; INSERT no habilita al rol parroquial.

**No reejecutar manualmente migraciones sobre esta base sin comprobar primero el historial de la base.** Las dos migraciones se aplicaron en octubre 21 mediante el conector de Supabase; la carpeta contiene copias fuente para reproducir en otros ambientes.

## Verificación
- `npm run build`: Vite 8.3.1, exit code 0.
- `node --test scripts/test-chancery-decrees-v88.mjs`: **20/20** pruebas ficticias de clases, efectos, reversibilidad y seguridad documental.
- `node scripts/verify-parish-decree-center-v30.mjs`: **38/38** verificaciones de ruta, roles y archivo parroquial.
- Prueba SQL transaccional: se crearon **8 decretos falsos** (4 nuevos, 4 históricos), se bloquearon número repetido e intento parroquial; las cantidades de las 4 tablas sacramentales no cambiaron.
- Prueba SQL transaccional de los **4 roles**: Administrador General, Diócesis, Cancillería, Parroquia pudieron consultar el expediente conforme a RLS; solo Cancillería pudo emitir. Se realizó `ROLLBACK`.
- Verificación postflight: **0 decretos ficticios persistentes; 0 eventos V88 ficticios persistentes**. Antes y después había dos decretos históricos de corrección (Bautismo / ANULACION.DBF).

## Límites y siguientes verificaciones
- **No se ha ejecutado una prueba de interacción visual autenticada navegador por navegador**, ni validación de firma/sello en impresión física.
- Los cambios del código deben publicarse en el frontend para que las nuevas rutas sean visibles; la instalación SQL no publica automáticamente la interfaz V88.
- Falta ampliar escenarios E2E con lotes históricos anómalos (datos faltantes, duplicados dentro de origen), reversión de todos los tipos registrales y cargas masivas multi-parroquia en un entorno desechable.
- No se han insertado permanentemente sujetos ficticios ni sacramentos de prueba.

## Comandos rápidos
```powershell
cd C:\SACRAMENTUM\SACRAMENTUM_FINAL
npm run build
node --test scripts/test-chancery-decrees-v88.mjs
node scripts/verify-parish-decree-center-v30.mjs
git status --short
```
