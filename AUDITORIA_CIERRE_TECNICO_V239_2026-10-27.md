# SACRAMENTUM FINAL V239 — Bloqueos reales de cuatro RPC de Cancillería

**27 de octubre de 2026. Entorno exclusivo QA:** `foczofcmwampjvlfbsqn`. La información es ficticia. No se modificaron datos ni esquema.

## Procedimientos examinados
- `public.apply_baptism_correction`
- `public.apply_baptism_replacement`
- `public.apply_confirmation_correction`
- `public.apply_confirmation_replacement`

Se usó acceso PostgreSQL real bajo `SET LOCAL ROLE authenticated`, con cuentas QA y `request.jwt.claim.sub` local, en transacciones `BEGIN READ ONLY ... ROLLBACK`. Los parámetros obligatorios se dejaron deliberadamente sin valor para verificar el **orden de los controles de acceso antes del manejo de datos**. Nunca se introdujo una partida real ni una modificación válida.

### Matriz observada

| Condición | Pruebas | Resultado |
|---|---:|---|
| Usuarios parroquia, diócesis y admin general intentan RPC de corrección/reposición | 12 | 12 denegadas por ausencia de rol Cancillería |
| Cancillería competente, contra parroquia de su diócesis | 4 | Las 4 superaron el control de jurisdicción y fallaron en validación de concepto obligatorio |
| Cancillería contra parroquia de otra diócesis | 4 | Las 4 rechazadas explícitamente por jurisdicción |
| **Total** | **20** | **20 resultados esperados; ninguna mutación** |

El helper `sacramentum_assert_chancery_for_parish` tampoco es directamente ejecutable por `authenticated` (denegación SQL de EXECUTE comprobada por separado): es alcanzable únicamente mediante las funciones públicas autorizadas u otras rutas privilegiadas.

## Método reproducible
Para cada rol y firma concreta se reprodujo una transacción equivalente a:

```sql
BEGIN READ ONLY;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '<QA_AUTH_USER_UUID>', true);
SELECT * FROM public.apply_baptism_correction(
  '<QA_PARISH_UUID>'::uuid,
  NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL
);
ROLLBACK;
```

Los identificadores no se incluyen en este informe. Se contrastó la denegación temprana de roles no autorizados, la jurisdicción ajena y la validación que sucede cuando el rol y la parroquia son correctos.

## Límite de certificación
**Esto NO aprueba semánticamente las cuatro funciones ni las 152 privilegiadas.** No se ejecutaron decretos válidos ni se probaron los efectos de las escrituras, sus transacciones completas, la concurrencia o rollback tras efectos parciales. Sirve como evidencia real de que los bloqueos de rol y diócesis preceden las validaciones de carga en cuatro rutas de alto riesgo.

`AUDITORIA_GUARDAS_RPC_QA_LIVE_V239.json` registra conteos y alcance sin identidades. `scripts/test-live-chancery-rpc-guards-v239.mjs` comprueba la **coherencia offline del acta**, no reejecuta las consultas reales en CI. La evidencia anterior V238 tiene 180 verificaciones; V239 agrega 20, para **200 observaciones reales realizadas durante esta auditoría**.

Permanecen pendientes el cierre de seguridad semántica de RPC, la base limpia independiente, la restauración verificable de backup, SMTP y la certificación institucional/impresa. El avance técnico ponderado continúa en **97,41 %** y el modo oficial sigue bloqueado.
