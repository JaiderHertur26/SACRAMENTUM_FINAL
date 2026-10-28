-- V274 · INSPECCIÓN SOLAMENTE. Corrección de identidades requiere
-- acreditación del titular y autorización institucional independiente.
-- No devuelve nombres, correos ni teléfonos: identifica UUID de perfil y ámbito.
-- Nunca ejecutar desde un navegador público ni almacenar resultados en Git.
WITH base AS (
 SELECT up.id AS profile_id,up.role,up.auth_user_id,up.diocese_id,
        up.parish_id,up.chancery_id,
        CASE WHEN up.auth_user_id IS NULL THEN 'SIN_IDENTIDAD_AUTH'
             WHEN au.id IS NULL THEN 'CUENTA_AUTH_INEXISTENTE' END AS identity_issue,
        CASE
          WHEN lower(up.role)='parish' AND
            (p.id IS NULL OR p.is_operational IS DISTINCT FROM TRUE
             OR p.diocese_id IS DISTINCT FROM up.diocese_id)
            THEN 'PARROQUIA_O_DIOCESIS_NO_COINCIDE'
          WHEN lower(up.role)='chancery' AND
            (c.id IS NULL OR c.diocese_id IS DISTINCT FROM up.diocese_id)
            THEN 'CANCILLERIA_O_DIOCESIS_NO_COINCIDE'
          WHEN lower(up.role)='diocese' AND d.id IS NULL
            THEN 'DIOCESIS_INEXISTENTE'
          WHEN lower(up.role)='admin_general' AND
            (up.diocese_id IS NOT NULL OR up.parish_id IS NOT NULL
             OR up.chancery_id IS NOT NULL)
            THEN 'ADMIN_GENERAL_CON_AMBITO_INDEBIDO'
          WHEN lower(up.role) NOT IN
            ('parish','chancery','diocese','admin_general')
            THEN 'ROL_SIN_POLITICA_DE_OPERACION'
        END AS scope_issue,
        count(*) OVER (PARTITION BY up.auth_user_id) AS linked_profile_count
 FROM public.user_profiles up
 LEFT JOIN auth.users au ON au.id=up.auth_user_id
 LEFT JOIN public.parishes p ON p.id=up.parish_id
 LEFT JOIN public.chancelleries c ON c.id=up.chancery_id
 LEFT JOIN public.dioceses d ON d.id=up.diocese_id
 WHERE up.is_active IS TRUE AND upper(coalesce(up.status,''))='ACTIVE'
)
SELECT profile_id,role,auth_user_id,diocese_id,parish_id,chancery_id,
 identity_issue,scope_issue,
 CASE WHEN auth_user_id IS NOT NULL AND linked_profile_count>1
      THEN 'CUENTA_AUTH_DUPLICADA' END AS duplicate_issue,
 CASE
  WHEN identity_issue IS NOT NULL THEN 'VERIFICAR_TITULAR_REAL_Y_VINCULAR_O_DESACTIVAR'
  WHEN scope_issue IS NOT NULL THEN 'VERIFICAR_JURISDICCION_INSTITUCIONAL'
  WHEN auth_user_id IS NOT NULL AND linked_profile_count>1
    THEN 'RESOLVER_MULTIPLICIDAD_DE_IDENTIDAD'
 END AS review_next_step
FROM base
WHERE identity_issue IS NOT NULL OR scope_issue IS NOT NULL
 OR (auth_user_id IS NOT NULL AND linked_profile_count>1)
ORDER BY role,profile_id;
