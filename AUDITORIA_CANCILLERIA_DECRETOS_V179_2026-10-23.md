# SACRAMENTUM FINAL — V179 · Cancillería: autorización de decretos y correcciones

23 de octubre de 2026 · C:\SACRAMENTUM\SACRAMENTUM_FINAL

## Hallazgo reproducido
Seis vías anteriores de asiento fueron cerradas en V178. En V179, la auditoría descubrió cinco nuevas vías institucionales débiles: corrección de Matrimonio, corrección de Exequias, reposición de Matrimonio, reposición de Exequias y nulidad matrimonial.
Un usuario Canciller ficticio con status=SUSPENDED e is_active=true superaba el filtro de rol y alcanzaba las siguientes comprobaciones de negocio. Se reproducen cinco comportamientos en una transacción PostgreSQL revertida; no se demuestra aquí que completara el decreto.
La primera variante del parche mostró un fallo adicional de lógica SQL de tres valores: si el filtro del perfil devuelve cero filas, v_role queda NULL y una comprobación IF v_role <> chancery THEN no da TRUE. Se corrigió de manera explícita con IS DISTINCT FROM, y se volvió a ejecutar toda la prueba.

## Corrección V179
Migración oficial 20261023221315_chancery_decree_fail_closed_v179.sql instalada en Supabase: en cinco funciones SECURITY DEFINER se exige is_active IS TRUE, upper(status)=ACTIVE y se cierra explícitamente la ausencia de rol. Los anclajes esperados se verifican antes de redefinir, sin cambiar firmas, permisos, registros, numeración, documentos ni controles documentales previos.

## Evidencia
5 de 5 llamadas ACTIVE atravesaron correctamente la autorización y alcanzaron validación funcional con entradas incompletas. 25 de 25 combinaciones incorrectas (SUSPENDED, NULL_STATUS, NULL_ACTIVE, DISABLED y WRONG_ROLE en cada una de cinco funciones) fueron denegadas explícitamente.
18 pruebas contractuales nuevas. Total 1.362/1.362 pruebas Node y 28/28 verificaciones estrictas, compilación y dependencias satisfactorias.
Instalada la migración permanente: se repitieron satisfactoriamente las 5 comprobaciones de autorización legítima y 25 rechazos. Cinco funciones quedaron verificadas, sin residuos QA-V179.
Se ejecutaron y aprobaron cuatro regresiones reales adicionales de correcciones, reposiciones, tribunal y denegación de nulidad sin autorización documental, cada una reversible con BEGIN/ROLLBACK.
Todos los datos de prueba (auth.users y user_profiles) fueron ficticios dentro de BEGIN/ROLLBACK.

## Límites
No se equipara una comprobación positiva de autorización con una corrección, reposición o nulidad completa. Tampoco se certifican dos sesiones autónomas autenticadas, concurrencia física PostgreSQL ni rendimiento. La certificación E2E íntegra sigue pendiente.
El plan maestro mantiene 325 controles: 10 APROBADO, 117 EN_PROGRESO, 198 PENDIENTE.

Migración y QA posteriores concluidos. Queda completar CI del último SHA de la PR, fusionarla y comprobar Vercel para declarar publicación de esta versión.
