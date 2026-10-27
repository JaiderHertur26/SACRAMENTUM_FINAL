# SACRAMENTUM FINAL — V249: identidad eclesial contemporánea

**27 de octubre de 2026 · Etapa visual y de experiencia de usuario · Datos de prueba.**

## Alcance y criterio

Se actualizó la arquitectura visual compartida para los roles **Diócesis**, **Cancillería** y **Parroquia**. La identidad es deliberadamente eclesial y moderna, no empresarial: marfil y pergamino para superficies, vino litúrgico profundo para navegación, oro envejecido discreto y verde sobrio; encabezados en tipografía serif, controles legibles, foco visible y menús adaptados a móvil. Mantiene el escudo institucional **auténtico** de la Arquidiócesis de Barranquilla solo cuando el perfil cumple `isBarranquillaInstitutionalUser`.

**Administrador General está expresamente excluido.** Se confirmó el uso de la clase `ecclesial-workspace` exclusivamente para `diocese`, `chancery` y `parish`. Su cabecera, menú, colores y rutas conservan la identidad preexistente. Se mantiene el aviso de **DATOS DE PRUEBA NO OFICIALES**.

Las portadas reales renovadas son `ParishDashboard.jsx`, `ChanceryDashboard.jsx` y `DioceseUserDashboard.jsx`, y la piel institucional común reside en `src/styles/ecclesial-workspace.css`, `DashboardLayout.jsx`, `Header.jsx`, `Sidebar.jsx`. Se modificó el panel eclesial de contexto y la navegación móvil; el Administrador General no utiliza esas variaciones. Se respetaron las clases de impresión: el nuevo CSS es `@media screen`, no altera la plantilla de partidas, libros o decretos. Se ajustó el chequeo crítico de CSS para validar los archivos divididos por Vite y confirmar que el tema institucional se entrega efectivamente.

## Cobertura sistemática por rol

El inventario real del AST de `src/App.jsx` produjo **7 rutas diocesanas, 15 de Cancillería, 32 parroquiales, 5 del Administrador General y una ruta compartida**, 57 rutas protegidas únicas (suma con compartidos sin duplicar). En la prueba de navegador se usan 2 viewports: **1365×900 escritorio** y **390×844 móvil**, y se visitan las rutas individuales de cada rol para un total de **118 recorridos**. La prueba exige menú, cabecera, panel contextual, componentes de formulario, tabla, tarjetas, presencia del escudo institucional y ausencia de desplazamiento horizontal. El Administrador General sirve como control negativo de estilo.

**Precisión metodológica:** estas visitas usan Chrome/React **reales para los componentes de diseño compartidos**, pero el contenido de cada módulo y la identidad se proveen mediante **fixtures ficticias**. No equivalen a afirmar que se iniciaron sesiones reales y se examinó cada componente interno del módulo (Bautismo, Confirmación, etc.). Para terminar la auditoría visual completa faltará navegar cada formulario interno con cuentas de QA y verificar estados de error, diálogos, impresión, contrastes WCAG en contexto, móviles y pantallas grandes. La presente ronda cubre identidad transversal y portadas reales; no sustituye esas comprobaciones.

## Regresión y publicación

La auditoría `npm run audit:master` incluye las nuevas pruebas `test-ecclesial-role-design-v249.mjs`, y el GitHub Actions suma un job **visual-eclesial-v249** que corre Chrome sin credenciales con inventario de rutas. El guard de CSS de V91 fue adaptado a la división legítima de estilos, y las pruebas históricas de Tailwind V127 dejan de exigir una antigua clase de color azul en la portada renovada. El build sigue siendo QA y la seguridad V248 de anulación documental se mantiene intacta.

**Progreso oficial del proyecto:** no debe confundirse esta mejora estética con la autorización de operación sacramental. Sigue en pruebas, sin habilitación oficial ni cambios de datos.
