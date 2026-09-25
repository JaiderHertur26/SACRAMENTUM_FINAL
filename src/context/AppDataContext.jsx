import React, { createContext, useContext, useState, useEffect } from 'react';
import { validateJSONStructure } from '@/utils/supabaseHelpers';
import { logAuthEvent } from '@/utils/authLogger';
import { supabase } from '@/lib/supabaseClient';

// --- SERVICIOS MODULARES ---
import * as ParamsService from '@/services/sacramentParametersService';
import * as NotesService from '@/services/marginalNotesService';
import * as CatalogsService from '@/services/catalogsService';
import * as SacramentsService from '@/services/sacramentsService';
import { refreshAuxiliaryCatalogCaches } from '@/services/auxiliaryCatalogHydrator';


export const AppDataContext = createContext(null);

const safeJsonParse = (str, fallback = []) => {
    if (!str || str === 'undefined' || str === 'null') return fallback;
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
};

const sanitizeUser = (u) => {
    if (!u) return null;
    const { password: _password, confirmPassword: _confirmPassword, ...safeUser } = u;
    return {
        ...safeUser,
        username: safeUser.username || '', role: safeUser.role || '',
        parishId: safeUser.parish_id || safeUser.parishId || null,
        dioceseId: safeUser.diocese_id || safeUser.dioceseId || null,
        chanceryId: safeUser.chancery_id || safeUser.chanceryId || null,
        parishName: safeUser.parish_name || safeUser.parishName || '',
        dioceseName: safeUser.diocese_name || safeUser.dioceseName || '',
        chancelleryName: safeUser.chancellery_name || safeUser.chancelleryName || ''
    };
};

const initializeData = () => {
  // Migración defensiva: ningún secreto de acceso debe permanecer en localStorage.
  const legacyUsers = safeJsonParse(localStorage.getItem('users'), []);
  if (legacyUsers.length > 0) {
    localStorage.setItem('users', JSON.stringify(legacyUsers.map(sanitizeUser)));
  }

  const collections = [
    'dioceses', 'vicariates', 'deaneries', 'parishes', 'chancelleries', 
    'mis_datos', 'parrocos', 'obispos', 'paises', 'ciudades', 'iglesias',
    'conceptosAnulacion'
  ];

  collections.forEach(key => {
    if (!localStorage.getItem(key)) {
       localStorage.setItem(key, JSON.stringify([]));
    }
  });
};

export const AppDataProvider = ({ children }) => {
  const [data, setData] = useState({
    users: [], dioceses: [], vicariates: [], deaneries: [], parishes: [], 
    chancelleries: [], chancellors: [], misDatos: [], conceptosAnulacion: []
  });

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
      const arrancarSistema = async () => {
          initializeData();

          const storedUser = localStorage.getItem('currentUser');
          const activeUser = storedUser ? safeJsonParse(storedUser, null) : null;
          if (activeUser) {
              setCurrentUser(activeUser);
              logAuthEvent(activeUser, 'CONTEXT_LOADED');
          }

          const cached = {
              users: safeJsonParse(localStorage.getItem('users'), []).map(sanitizeUser),
              dioceses: safeJsonParse(localStorage.getItem('dioceses'), []),
              parishes: safeJsonParse(localStorage.getItem('parishes'), []),
              chancelleries: safeJsonParse(localStorage.getItem('chancelleries'), []),
              chancellors: safeJsonParse(localStorage.getItem('chancellors'), []),
              vicariates: safeJsonParse(localStorage.getItem('vicariates'), []),
              deaneries: safeJsonParse(localStorage.getItem('deaneries'), []),
              misDatos: safeJsonParse(localStorage.getItem('mis_datos'), []),
          };

          // El almacenamiento local sirve sólo como caché de arranque. La fuente de
          // verdad institucional se refresca inmediatamente desde Supabase/RLS.
          setData(prev => ({ ...prev, ...cached }));

          try {
              const [usersRes, diocesesRes, parishesRes, chancelleriesRes, vicariasRes, decanatosRes, misDatosRes] = await Promise.all([
                  supabase.from('user_profiles').select('*'),
                  supabase.from('dioceses').select('*'),
                  supabase.from('parishes').select('*'),
                  supabase.from('chancelleries').select('*'),
                  supabase.from('vicarias').select('*'),
                  supabase.from('decanatos').select('*'),
                  supabase.from('mis_datos').select('*'),
              ]);

              const users = !usersRes.error && Array.isArray(usersRes.data)
                  ? usersRes.data.map(sanitizeUser)
                  : cached.users;
              const dioceses = !diocesesRes.error && Array.isArray(diocesesRes.data)
                  ? diocesesRes.data
                  : cached.dioceses;
              const parishes = !parishesRes.error && Array.isArray(parishesRes.data)
                  ? parishesRes.data
                  : cached.parishes;
              const chancelleries = !chancelleriesRes.error && Array.isArray(chancelleriesRes.data)
                  ? chancelleriesRes.data
                  : cached.chancelleries;
              const vicariates = !vicariasRes.error && Array.isArray(vicariasRes.data)
                  ? vicariasRes.data.map(v => ({ ...v, dioceseId: v.diocese_id, name: v.name, vicar_name: v.vicar_name }))
                  : cached.vicariates;
              const deaneries = !decanatosRes.error && Array.isArray(decanatosRes.data)
                  ? decanatosRes.data.map(d => ({ ...d, vicaryId: d.vicaria_id, name: d.name, dean_name: d.dean_name }))
                  : cached.deaneries;
              const misDatos = !misDatosRes.error && Array.isArray(misDatosRes.data)
                  ? misDatosRes.data
                  : cached.misDatos;
              const chancellors = users.filter(u => String(u?.role || '').toLowerCase() === 'chancery');

              localStorage.setItem('users', JSON.stringify(users));
              localStorage.setItem('dioceses', JSON.stringify(dioceses));
              localStorage.setItem('parishes', JSON.stringify(parishes));
              localStorage.setItem('chancelleries', JSON.stringify(chancelleries));
              localStorage.setItem('chancellors', JSON.stringify(chancellors));
              localStorage.setItem('vicariates', JSON.stringify(vicariates));
              localStorage.setItem('deaneries', JSON.stringify(deaneries));
              localStorage.setItem('mis_datos', JSON.stringify(misDatos));

              setData(prev => ({
                  ...prev,
                  users,
                  dioceses,
                  parishes,
                  chancelleries,
                  chancellors,
                  vicariates,
                  deaneries,
                  misDatos,
              }));

              try {
                  await refreshAuxiliaryCatalogCaches(activeUser);
              } catch (catalogError) {
                  console.warn('SACRAMENTUM: no fue posible refrescar todos los catalogos auxiliares.', catalogError);
              }
          } catch (error) {
              console.warn('SACRAMENTUM: no fue posible refrescar el caché institucional desde Supabase.', error);
          }

          window.dispatchEvent(new Event('storage'));
      };

      arrancarSistema();
  }, []);

  // Las escrituras institucionales (usuarios, jurisdicciones y estructura)
  // se realizan exclusivamente mediante servicios Supabase/RPC de cada módulo.


  return (
    <AppDataContext.Provider value={{
        data,
        validateJSONStructure,
        user: currentUser,
        // --- SACRAMENTOS (BAUTISMO) ---
        purificarRegistroBautismo: SacramentsService.purificarRegistroBautismo,
        saveBaptismToSource: SacramentsService.saveBaptismToSource,
        getBaptisms: SacramentsService.getBaptisms,
        getPendingBaptisms: SacramentsService.getPendingBaptisms,
        fetchBaptismsFromSource: SacramentsService.fetchBaptismsFromSource,

        // --- SACRAMENTOS (CONFIRMACIÓN & MATRIMONIO) ---

        // --- PARÁMETROS SACRAMENTALES ---
        getBaptismParameters: (ctxId) => ParamsService.getBaptismParameters(ctxId || currentUser?.parishId),
        saveBaptismParameters: (params, ctxId) => ParamsService.saveBaptismParameters(params, ctxId || currentUser?.parishId),
        getNextBaptismNumbers: (pId) => ParamsService.getNextBaptismNumbers(pId || currentUser?.parishId),
        getConfirmationParameters: (ctxId) => ParamsService.getConfirmationParameters(ctxId || currentUser?.parishId),
        updateConfirmationParameters: (ctxId, p) => ParamsService.updateConfirmationParameters(ctxId || currentUser?.parishId, p),
        resetConfirmationParameters: (ctxId) => ParamsService.resetConfirmationParameters(ctxId || currentUser?.parishId),
        getNextConfirmationNumbers: (pId) => ParamsService.getNextConfirmationNumbers(pId || currentUser?.parishId),
        getMatrimonioParameters: (ctxId) => ParamsService.getMatrimonioParameters(ctxId || currentUser?.parishId),
        updateMatrimonioParameters: (ctxId, p) => ParamsService.updateMatrimonioParameters(ctxId || currentUser?.parishId, p),
        resetMatrimonioParameters: (ctxId) => ParamsService.resetMatrimonioParameters(ctxId || currentUser?.parishId),
        getNextMatrimonioNumbers: (pId) => ParamsService.getNextMatrimonioNumbers(pId || currentUser?.parishId),

        // --- NOTAS MARGINALES ---
        obtenerNotasAlMargen: NotesService.obtenerNotasAlMargen,
        saveNotasAlMargen: NotesService.saveNotasAlMargen,
        generarNotaAlMargenAnulada: NotesService.generarNotaAlMargenAnulada,
        generarNotaAlMargenNuevaPartida: NotesService.generarNotaAlMargenNuevaPartida,
        generarNotaAlMargenEstandar: NotesService.generarNotaAlMargenEstandar,
        actualizarNotaAlMargenCorreccion: NotesService.actualizarNotaAlMargenCorreccion,
        actualizarNotaAlMargenReposicion: NotesService.actualizarNotaAlMargenReposicion,
        actualizarNotaAlMargenEstandar: NotesService.actualizarNotaAlMargenEstandar,

        // --- CATÁLOGOS Y AUXILIARES ---
        getParrocos: CatalogsService.getParrocos,
        getParrocoActual: CatalogsService.getParrocoActual,
        addParroco: CatalogsService.addParroco,
        updateParroco: CatalogsService.updateParroco,
        deleteParroco: CatalogsService.deleteParroco,
        actualizarParrocoActual: CatalogsService.actualizarParrocoActual,
        importParrocos: CatalogsService.importParrocos,
        
        getDiocesis: CatalogsService.getDiocesis,
        addDiocesis: CatalogsService.addDiocesis,
        updateDiocesis: CatalogsService.updateDiocesis,
        deleteDiocesis: CatalogsService.deleteDiocesis,
        importDiocesis: CatalogsService.importDiocesis, // 🚀 AGREGADO

        getIglesias: CatalogsService.getIglesias,
        getIglesiasList: CatalogsService.getIglesiasList,
        addIglesia: CatalogsService.addIglesia,
        updateIglesia: CatalogsService.updateIglesia,
        deleteIglesia: CatalogsService.deleteIglesia,
        importIglesias: CatalogsService.importIglesias, // 🚀 AGREGADO

        getObispos: CatalogsService.getObispos,
        addObispo: CatalogsService.addObispo,
        updateObispo: CatalogsService.updateObispo,
        deleteObispo: CatalogsService.deleteObispo,
        importObispos: CatalogsService.importObispos, // 🚀 AGREGADO

        getCiudadesList: CatalogsService.getCiudadesList,
        addCiudad: CatalogsService.addCiudad,
        updateCiudad: CatalogsService.updateCiudad,
        deleteCiudad: CatalogsService.deleteCiudad,
        importCiudades: CatalogsService.importCiudades,
        
        getPaises: CatalogsService.getPaises,
        getParroquiasExternas: CatalogsService.getParroquiasExternas,

        // --- MEMBRETES (MIS DATOS) ---
        getMisDatosList: CatalogsService.getMisDatosList,
        addMisDatosRecord: CatalogsService.addMisDatosRecord,
        updateMisDatosRecord: CatalogsService.updateMisDatosRecord,
        deleteMisDatosRecord: CatalogsService.deleteMisDatosRecord,
        addMisDatos: CatalogsService.addMisDatosRecord,
        updateMisDatos: CatalogsService.updateMisDatosRecord,
        deleteMisDatos: CatalogsService.deleteMisDatosRecord,
        importMisDatos: CatalogsService.importMisDatos, // 🚀 AGREGADO

        // --- DECRETOS ---
        // La emisión/reversión jurídica se realiza en páginas de Cancillería mediante RPC auditadas.

        // Las exportaciones institucionales se realizan desde servicios de respaldo
        // conectados a Supabase; este contexto ya no expone operaciones simuladas.
    }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used within AppDataProvider');
  return context;
};