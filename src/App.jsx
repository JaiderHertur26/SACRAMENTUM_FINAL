/*
  ========================================================================
  APP CONFIGURATION & ROUTING STRUCTURE
  ========================================================================
*/

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from '@/context/AuthContext';
import { AppDataProvider } from '@/context/AppDataContext';

import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from '@/components/ScrollToTop';
import { Toaster } from '@/components/ui/toaster';
import InstitutionalDialogHost from '@/components/ui/InstitutionalDialogHost';
import GlobalSyncIndicator from '@/components/GlobalSyncIndicator';
import { ROLE_TYPES } from '@/config/supabaseConfig';


/* =========================
   PUBLIC & SHARED PAGES
========================= */
const PublicSearchPage = lazy(() => import('@/pages/PublicSearchPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const AccountConfigurationErrorPage = lazy(() => import('@/pages/AccountConfigurationErrorPage'));
const CommunicationsPage = lazy(() => import('@/pages/CommunicationsPage'));
const UnifiedSearchPage = lazy(() => import('@/pages/UnifiedSearchPage'));
const DocumentTemplateLibraryPage = lazy(() => import('@/pages/DocumentTemplateLibraryPage'));

/* =========================
   ADMIN PAGES
========================= */
const AdminGeneralDashboard = lazy(() => import('@/pages/admin/AdminGeneralDashboard'));
const DioceseListPage = lazy(() => import('@/pages/admin/DioceseListPage'));
const UserListPage = lazy(() => import('@/pages/admin/UserListPage'));
const LegacyMigrationCenterPage = lazy(() => import('@/pages/admin/LegacyMigrationCenterPage'));

/* =========================
   DIOCESE PAGES
========================= */
const DioceseUserDashboard = lazy(() => import('@/pages/diocese/DioceseUserDashboard'));
const DioceseEcclesiasticalPage = lazy(() => import('@/pages/diocese/DioceseEcclesiasticalPage'));
const DiocesanSacramentalReportsPage = lazy(() => import('@/pages/diocese/DiocesanSacramentalReportsPage'));

/* =========================
   PARISH PAGES
========================= */
const ParishDashboard = lazy(() => import('@/pages/parish/ParishDashboard'));
const ParroquiaAjustesPage = lazy(() => import('@/pages/parish/ParroquiaAjustesPage'));
const DatosAuxiliaresPage = lazy(() => import('@/pages/parish/DatosAuxiliaresPage'));
const ParishNotificationsPage = lazy(() => import('@/pages/parish/ParishNotificationsPage'));
const SacramentalNotificationsPage = lazy(() => import('@/pages/parish/SacramentalNotificationsPage'));
const ParishDecreeDetailPage = lazy(() => import('@/pages/parish/ParishDecreeDetailPage'));

/* --- BAPTISM --- */
const BaptismNewPage = lazy(() => import('@/pages/parish/BaptismNewPage'));
const BaptismCelebratedPage = lazy(() => import('@/pages/parish/BaptismCelebratedPage'));
const BaptismSentarRegistrosPage = lazy(() => import('@/pages/parish/BaptismSentarRegistrosPage'));
const BaptismIndexPage = lazy(() => import('@/pages/parish/BaptismIndexPage'));
const BaptismParametersPage = lazy(() => import('@/pages/parish/BaptismParametersPage'));
const BaptismPartidasPage = lazy(() => import('@/pages/parish/BaptismPartidasPage'));
const BaptismDetailPage = lazy(() => import('@/pages/BaptismDetailPage'));
const BaptismRepositionListPage = lazy(() => import('@/pages/parish/BaptismRepositionListPage'));
const BaptismCorrectionListPage = lazy(() => import('@/pages/parish/BaptismCorrectionListPage'));

/* --- CONFIRMATION --- */
const ConfirmationNewPage = lazy(() => import('@/pages/parish/ConfirmationNewPage'));
const ConfirmationCelebratedPage = lazy(() => import('@/pages/parish/ConfirmationCelebratedPage'));
const ConfirmationSentarRegistrosPage = lazy(() => import('@/pages/parish/ConfirmationSentarRegistrosPage'));
const ConfirmationIndexPage = lazy(() => import('@/pages/parish/ConfirmationIndexPage'));
const ConfirmationParametersPage = lazy(() => import('@/pages/parish/ConfirmationParametersPage'));
const ConfirmationPartidasPage = lazy(() => import('@/pages/parish/ConfirmationPartidasPage'));
const ConfirmationCorrectionListPage = lazy(() => import('@/pages/parish/ConfirmationCorrectionListPage'));

/* --- MATRIMONIO --- */
const MatrimonioNewPage = lazy(() => import('@/pages/parish/MatrimonioNewPage'));
const MatrimonioCelebratedPage = lazy(() => import('@/pages/parish/MatrimonioCelebratedPage'));
const MatrimonioSentarRegistrosPage = lazy(() => import('@/pages/parish/MatrimonioSentarRegistrosPage'));
const MarriageIndexPage = lazy(() => import('@/pages/parish/MarriageIndexPage'));
const MatrimonioParametersPage = lazy(() => import('@/pages/parish/MatrimonioParametersPage'));
const MatrimonioPartidasPage = lazy(() => import('@/pages/parish/MatrimonioPartidasPage'));
const FuneralRegistryPage = lazy(() => import('@/pages/parish/FuneralRegistryPage'));
const FuneralPartidasPage = lazy(() => import('@/pages/parish/FuneralPartidasPage'));

/* --- DECREES (CORRECTION & REPLACEMENT - CHANCERY) --- */
const NewDecreeCorrectionPage = lazy(() => import('@/pages/chancery/decree-correction/NewDecreeCorrectionPage'));
const NewConfirmationCorrectionPage = lazy(() => import('@/pages/chancery/decree-correction/NewConfirmationCorrectionPage'));
const FuneralDecreesPage = lazy(() => import('@/pages/chancery/exequias/FuneralDecreesPage'));
const SacramentalDecreesCenterPage = lazy(() => import('@/pages/chancery/SacramentalDecreesCenterPage'));
const SacramentalDecreeArchivePage = lazy(() => import('@/pages/chancery/SacramentalDecreeArchivePage'));
const MarriageDecreesPage = lazy(() => import('@/pages/chancery/marriage/MarriageDecreesPage'));

const NewDecreeReplacementPage = lazy(() => import('@/pages/chancery/decree-replacement/NewDecreeReplacementPage'));
const NewConfirmationReplacementPage = lazy(() => import('@/pages/chancery/decree-replacement/NewConfirmationReplacementPage'));

/* --- ANNULMENT (PARISH) --- */

/* --- ANNULMENT (CHANCERY) --- */
const ChanceryAnnulmentConceptsPage = lazy(() => import('@/pages/chancery/decree-annulment/AnnulmentConceptsPage'));

/* --- MARRIAGE NOTIFICATIONS (NOTIFICACIÃ“N MATRIMONIAL) --- */
const NotificacionMatrimonialPage = lazy(() => import('@/pages/parish/NotificacionMatrimonialPage'));

/* =========================
   OTHER SACRAMENTS
========================= */

/* =========================
   CHANCERY
========================= */
const ChanceryDashboard = lazy(() => import('@/pages/chancery/ChanceryDashboard'));
const ChanceryPendingPage = lazy(() => import('@/pages/chancery/ChanceryPendingPage'));

/* =========================
   DEBUG
========================= */
const DebugAuthPage = lazy(() => import('@/pages/DebugAuthPage'));

/* =========================
   APP ROUTES
========================= */
const RouteLoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-700" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600">Cargando mÃ³duloâ€¦</p>
        </div>
    </div>
);

const AppContent = () => {
    return (
        <>
            <ScrollToTop />

            <Suspense fallback={<RouteLoadingScreen />}>
                <Routes>
                {/* -------- PUBLIC -------- */}
                <Route path="/" element={<PublicSearchPage />} />
                <Route path="/login" element={<PublicSearchPage />} />
                <Route path="/account-configuration-error" element={<AccountConfigurationErrorPage />} />

                {/* -------- DEBUG -------- */}
                <Route path="/debug-auth" element={<ProtectedRoute requiredRole={ROLE_TYPES.ADMIN_GENERAL}><DebugAuthPage /></ProtectedRoute>} />

                {/* -------- ADMIN (SUPER ADMIN) -------- */}
                <Route
                    path="/admin/dashboard"
                    element={
                        <ProtectedRoute requiredRole={ROLE_TYPES.ADMIN_GENERAL}>
                            <AdminGeneralDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route path="/admin/dioceses" element={<ProtectedRoute requiredRole={ROLE_TYPES.ADMIN_GENERAL}><DioceseListPage /></ProtectedRoute>} />
                <Route path="/admin/archdioceses" element={<Navigate to="/admin/dioceses" replace />} />
                <Route path="/admin/users" element={<ProtectedRoute requiredRole={ROLE_TYPES.ADMIN_GENERAL}><UserListPage /></ProtectedRoute>} />
                <Route path="/admin/settings" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/migration-center" element={<ProtectedRoute requiredRole={ROLE_TYPES.ADMIN_GENERAL}><LegacyMigrationCenterPage /></ProtectedRoute>} />
                <Route path="/admin/users/diocese" element={<Navigate to="/admin/users" replace />} />

                {/* -------- DIOCESE -------- */}
                <Route path="/diocese/dashboard" element={<ProtectedRoute requiredRole={ROLE_TYPES.DIOCESE}><DioceseUserDashboard /></ProtectedRoute>} />
                <Route path="/diocese/ecclesiastical" element={<ProtectedRoute requiredRole={ROLE_TYPES.DIOCESE}><DioceseEcclesiasticalPage /></ProtectedRoute>} />
                <Route path="/diocese/settings" element={<Navigate to="/diocese/dashboard" replace />} />
                <Route path="/diocese/parishes" element={<Navigate to="/diocese/ecclesiastical" replace />} />
                <Route path="/diocese/migration-center" element={<ProtectedRoute requiredRole={ROLE_TYPES.DIOCESE}><LegacyMigrationCenterPage /></ProtectedRoute>} />
                <Route path="/diocese/reports" element={<ProtectedRoute requiredRole={ROLE_TYPES.DIOCESE}><DiocesanSacramentalReportsPage /></ProtectedRoute>} />

                {/* -------- PARISH -------- */}
                <Route path="/parish/dashboard" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><ParishDashboard /></ProtectedRoute>} />
                <Route path="/parish/notifications" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><ParishNotificationsPage /></ProtectedRoute>} />
                <Route path="/parish/sacramental-notifications" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><SacramentalNotificationsPage /></ProtectedRoute>} />
                <Route path="/parish/decrees/:decreeId" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><ParishDecreeDetailPage /></ProtectedRoute>} />
                <Route path="/parroquia/ajustes" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><ParroquiaAjustesPage /></ProtectedRoute>} />
                <Route path="/datos-auxiliares" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><DatosAuxiliaresPage /></ProtectedRoute>} />

                {/* --- BAPTISM ROUTES --- */}
                <Route path="/parroquia/bautismo/nuevo" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><BaptismNewPage /></ProtectedRoute>} />
                <Route path="/parroquia/bautismo/editar" element={<Navigate to="/parroquia/bautismo/partidas" replace />} />
                <Route path="/parroquia/bautismo/celebrado" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><BaptismCelebratedPage /></ProtectedRoute>} />
                <Route path="/parroquia/bautismo/sentar-registros" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><BaptismSentarRegistrosPage /></ProtectedRoute>} />
                <Route path="/parroquia/bautismo/asentar" element={<Navigate to="/parroquia/bautismo/sentar-registros" replace />} />
                <Route path="/parroquia/bautismo/partidas" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><BaptismPartidasPage /></ProtectedRoute>} />
                <Route path="/parroquia/bautismo/base-datos" element={<Navigate to="/parroquia/bautismo/partidas" replace />} />
                <Route path="/parroquia/bautismo/indice" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><BaptismIndexPage /></ProtectedRoute>} />
                <Route path="/parroquia/bautismo/parametros" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><BaptismParametersPage /></ProtectedRoute>} />
                <Route path="/parroquia/parametros" element={<Navigate to="/parroquia/bautismo/parametros" replace />} />
                <Route path="/parroquia/bautismo/:baptismPartidaId" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><BaptismDetailPage /></ProtectedRoute>} />

                {/* --- DECREES (ReposiciÃ³n & CorrecciÃ³n - Parish) --- */}
                <Route path="/parroquia/decretos/nuevo-reposicion" element={<Navigate to="/parroquia/decretos/reposicion" replace />} />
                <Route path="/parish/decree-replacement/new" element={<Navigate to="/parish/decree-replacement/view" replace />} />
                <Route path="/parroquia/decretos/reposicion" element={<Navigate to="/parish/decree-replacement/view" replace />} />
                <Route path="/parish/decree-replacement/view" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><BaptismRepositionListPage /></ProtectedRoute>} />
                <Route path="/parroquia/decretos/editar-reposicion" element={<Navigate to="/parroquia/decretos/reposicion" replace />} />
                <Route path="/parish/decree-replacement/edit" element={<Navigate to="/parish/decree-replacement/view" replace />} />

                <Route path="/parish/decree-correction/new" element={<Navigate to="/parish/decree-correction/view" replace />} />
                <Route path="/parroquia/decretos/nuevo-correccion" element={<Navigate to="/parish/decree-correction/view" replace />} />
                <Route path="/parish/decree-correction/view" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><BaptismCorrectionListPage /></ProtectedRoute>} />
                <Route path="/parroquia/decretos/ver-correcciones" element={<Navigate to="/parish/decree-correction/view" replace />} />
                <Route path="/parish/decree-correction/edit" element={<Navigate to="/parish/decree-correction/view" replace />} />
                <Route path="/parroquia/decretos/editar-correccion" element={<Navigate to="/parish/decree-correction/view" replace />} />

                {/* ðŸš€ AÃ‘ADIDO: Rutas para el Nuevo Decreto de CorrecciÃ³n de ConfirmaciÃ³n */}
                <Route path="/parroquia/decretos/nuevo-correccion-confirmacion" element={<Navigate to="/parroquia/decretos/ver-correcciones-confirmacion" replace />} />
                <Route path="/parroquia/decretos/ver-correcciones-confirmacion" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><ConfirmationCorrectionListPage /></ProtectedRoute>} />

                {/* --- CONFIRMATION ROUTES --- */}
                <Route path="/parroquia/confirmacion/nuevo" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><ConfirmationNewPage /></ProtectedRoute>} />
                <Route path="/parroquia/confirmacion/editar" element={<Navigate to="/parroquia/confirmacion/partidas" replace />} />
                <Route path="/parroquia/confirmacion/celebrado" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><ConfirmationCelebratedPage /></ProtectedRoute>} />
                <Route path="/parroquia/confirmacion/sentar-registros" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><ConfirmationSentarRegistrosPage /></ProtectedRoute>} />
                <Route path="/parroquia/confirmacion/asentar" element={<Navigate to="/parroquia/confirmacion/sentar-registros" replace />} />
                <Route path="/parroquia/confirmacion/partidas" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><ConfirmationPartidasPage /></ProtectedRoute>} />
                <Route path="/parroquia/confirmacion/indice" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><ConfirmationIndexPage /></ProtectedRoute>} />
                <Route path="/parroquia/confirmacion/parametros" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><ConfirmationParametersPage /></ProtectedRoute>} />

                {/* --- MATRIMONIO ROUTES --- */}
                <Route path="/parroquia/matrimonio/nuevo" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><MatrimonioNewPage /></ProtectedRoute>} />
                <Route path="/parroquia/matrimonio/editar" element={<Navigate to="/parroquia/matrimonio/partidas" replace />} />
                <Route path="/parroquia/matrimonio/celebrado" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><MatrimonioCelebratedPage /></ProtectedRoute>} />
                <Route path="/parroquia/matrimonio/sentar-registros" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><MatrimonioSentarRegistrosPage /></ProtectedRoute>} />
                <Route path="/parroquia/matrimonio/asentar" element={<Navigate to="/parroquia/matrimonio/sentar-registros" replace />} />
                <Route path="/parroquia/matrimonio/partidas" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><MatrimonioPartidasPage /></ProtectedRoute>} />
                <Route path="/parroquia/matrimonio/indice" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><MarriageIndexPage /></ProtectedRoute>} />
                <Route path="/parroquia/matrimonio/parametros" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><MatrimonioParametersPage /></ProtectedRoute>} />

                {/* --- EXEQUIAS --- */}
                <Route path="/parroquia/exequias" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><FuneralRegistryPage /></ProtectedRoute>} />



                {/* --- EXEQUIAS ROUTES Â· FASE 5D 030B --- */}
                <Route path="/parroquia/exequias/partidas" element={<ProtectedRoute requiredRole="parish"><FuneralPartidasPage /></ProtectedRoute>} />
                <Route path="/parroquia/exequias/parametros" element={<Navigate to="/parroquia/bautismo/parametros?tab=exequias" replace />} />

                {/* --- ANNULMENT (PARISH) --- */}
                <Route path="/parroquia/decretos/nulidad" element={<Navigate to="/parish/dashboard" replace />} />
                <Route path="/parish/annulment-concepts" element={<Navigate to="/parish/dashboard" replace />} />

                {/* --- MARRIAGE NOTIFICATIONS (PARISH) --- */}
                <Route path="/parroquia/matrimonio/notificacion" element={<ProtectedRoute requiredRole={ROLE_TYPES.PARISH}><NotificacionMatrimonialPage /></ProtectedRoute>} />
                <Route path="/parroquia/aviso-notificacion" element={<Navigate to="/parish/sacramental-notifications" replace />} />
                <Route path="/parroquia/matrimonio/aviso-notificacion" element={<Navigate to="/parish/sacramental-notifications" replace />} />

                {/* -------- OTHER SACRAMENTS -------- */}
                <Route path="/sacraments/marriage/*" element={<Navigate to="/parroquia/matrimonio/partidas" replace />} />

                {/* -------- CHANCERY -------- */}
                <Route path="/chancery/dashboard" element={<ProtectedRoute requiredRole={ROLE_TYPES.CHANCERY}><ChanceryDashboard /></ProtectedRoute>} />
                <Route path="/chancery/pending" element={<ProtectedRoute requiredRole={ROLE_TYPES.CHANCERY}><ChanceryPendingPage /></ProtectedRoute>} />
                <Route path="/chancery/certifications" element={<Navigate to="/chancery/dashboard" replace />} />
                <Route path="/chancery/backups" element={<Navigate to="/chancery/dashboard" replace />} />

                {/* --- CENTRO UNIFICADO DE DECRETOS SACRAMENTALES Â· FASE 033 --- */}
                <Route path="/chancery/decretos" element={<ProtectedRoute requiredRole={ROLE_TYPES.CHANCERY}><SacramentalDecreesCenterPage /></ProtectedRoute>} />
                <Route path="/chancery/decretos/archivo" element={<ProtectedRoute requiredRole={ROLE_TYPES.CHANCERY}><SacramentalDecreeArchivePage /></ProtectedRoute>} />
                <Route path="/chancery/matrimonio/decretos" element={<ProtectedRoute requiredRole={ROLE_TYPES.CHANCERY}><MarriageDecreesPage /></ProtectedRoute>} />

                {/* --- DECREES (CORRECTION & REPLACEMENT - CHANCERY) --- */}
                <Route path="/chancery/decretos/correcciones" element={<Navigate to="/chancery/decretos/archivo?type=correccion" replace />} />
                <Route path="/chancery/decretos/reposiciones" element={<Navigate to="/chancery/decretos/archivo?type=reposicion" replace />} />

                <Route path="/chancery/decree-correction/new" element={<ProtectedRoute requiredRole={ROLE_TYPES.CHANCERY}><NewDecreeCorrectionPage /></ProtectedRoute>} />
                <Route path="/chancery/decree-correction/new-confirmation" element={<ProtectedRoute requiredRole={ROLE_TYPES.CHANCERY}><NewConfirmationCorrectionPage /></ProtectedRoute>} />
                <Route path="/chancery/exequias/decretos" element={<ProtectedRoute requiredRole={ROLE_TYPES.CHANCERY}><FuneralDecreesPage /></ProtectedRoute>} />
                <Route path="/chancery/decree-correction" element={<Navigate to="/chancery/decretos/archivo?type=correccion" replace />} />
                <Route path="/chancery/decree-correction/view" element={<Navigate to="/chancery/decretos/archivo?type=correccion" replace />} />
                <Route path="/chancery/decree-correction/edit" element={<Navigate to="/chancery/decree-correction/view" replace />} />
                
                <Route path="/chancery/decree-replacement/new" element={<ProtectedRoute requiredRole={ROLE_TYPES.CHANCERY}><NewDecreeReplacementPage /></ProtectedRoute>} />
                <Route path="/chancery/decree-replacement/new-confirmation" element={<ProtectedRoute requiredRole={ROLE_TYPES.CHANCERY}><NewConfirmationReplacementPage /></ProtectedRoute>} />
                <Route path="/chancery/decree-replacement" element={<Navigate to="/chancery/decretos/archivo?type=reposicion" replace />} />
                <Route path="/chancery/decree-replacement/view" element={<Navigate to="/chancery/decretos/archivo?type=reposicion" replace />} />
                <Route path="/chancery/decree-replacement/edit" element={<Navigate to="/chancery/decree-replacement/view" replace />} />
                
                {/* Redirecciones de seguridad por las rutas purgadas */}
                <Route path="/chancery/decree-correction/list" element={<Navigate to="/chancery/decretos/archivo?type=correccion" replace />} />
                <Route path="/chancery/decree-replacement/list" element={<Navigate to="/chancery/decretos/archivo?type=reposicion" replace />} />

                {/* --- ANNULMENT (CHANCERY) --- */}
                <Route path="/chancery/decree-annulment" element={<ProtectedRoute requiredRole={ROLE_TYPES.CHANCERY}><ChanceryAnnulmentConceptsPage /></ProtectedRoute>} />
                <Route path="/chancery/marriage-nullity" element={<Navigate to="/chancery/decretos" replace />} />

                {/* -------- SHARED (DISPONIBLES PARA CUALQUIER ROL AUTENTICADO) -------- */}
                <Route path="/communications" element={<ProtectedRoute requiredRole={[ROLE_TYPES.DIOCESE, ROLE_TYPES.CHANCERY, ROLE_TYPES.PARISH]}><CommunicationsPage /></ProtectedRoute>} />
                <Route path="/buscar" element={<ProtectedRoute><UnifiedSearchPage /></ProtectedRoute>} /> {/* ðŸš€ AÃ‘ADIDO: Ruta del Buscador Interno */}
                <Route path="/documentos/plantillas" element={<ProtectedRoute><DocumentTemplateLibraryPage /></ProtectedRoute>} />

                {/* -------- ERRORS -------- */}
                <Route path="/404" element={<NotFoundPage />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
            </Suspense>

            <InstitutionalDialogHost />
            <Toaster />
            <GlobalSyncIndicator />
        </>
    );
};

/* =========================
   ROOT APP
========================= */
export default function App() {
    return (
        <Router>
            <AppDataProvider>
                <AuthProvider>
                    <AppContent />
                </AuthProvider>
            </AppDataProvider>
        </Router>
    );
}

