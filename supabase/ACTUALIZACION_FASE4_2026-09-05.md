# SACRAMENTUM · Actualización Fase 4 Territorial · 2026-09-05

Este paquete toma como base el Supabase consolidado de Fase 3 y añade la capa territorial cloud-native definitiva.

## Nuevo en Fase 4

- `20260905_025_territorial_integrity_and_activation_hardening.sql`
- pre-flight y post-flight específicos de estructura territorial
- `activate-environment` endurecida
- gobierno de tokens coherente con roles
- jerarquía obligatoria Diócesis/Arquidiócesis → Vicaría → Decanato → Parroquia
- una Cancillería por jurisdicción
- protección contra cruces territoriales y borrados destructivos
- Parroquia/Cancillería creadas únicamente por activación server-side
- Admin General sin escritura sobre la estructura interna de las jurisdicciones

## Estado de referencia

Las migraciones 001–024 ya forman la base previa. La migración 025 es incremental y debe ejecutarse sólo después del pre-flight de Fase 4.

No se incluye `supabase/.temp`, `.env` ni secretos. El vínculo local de la CLI no forma parte del paquete maestro.
