import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const text = (value: unknown, max = 180) => String(value ?? '').trim().slice(0, max);
const lower = (value: unknown) => text(value).toLowerCase();
const upper = (value: unknown) => text(value).toUpperCase();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'Server configuration incomplete' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let createdAuthUserId: string | null = null;
  let createdEntity: { table: string; id: string } | null = null;
  let claimedToken: any = null;

  try {
    const requestBody = await req.json();
    const token = text(requestBody?.token, 240);
    const email = lower(requestBody?.email);
    const password = String(requestBody?.password || '');
    const fullName = text(requestBody?.fullName, 160);

    if (!token || !fullName || !email || password.length < 8) {
      return json(400, { error: 'Token, nombre completo, correo y una contraseña de mínimo 8 caracteres son requeridos.' });
    }

    // Reclamo atómico. Si algo falla, el código se restaura en el rollback.
    const { data: tokenRecord, error: tokenError } = await admin
      .from('pending_tokens')
      .delete()
      .eq('token', token)
      .select('*')
      .maybeSingle();

    if (tokenError) throw tokenError;
    if (!tokenRecord) return json(400, { error: 'Código de activación inválido o ya utilizado.' });
    claimedToken = tokenRecord;

    const data = tokenRecord.payload || {};
    const tokenType = upper(tokenRecord.type);
    const creatorAuthId = tokenRecord.created_by || null;

    if (!creatorAuthId) throw new Error('El código no tiene un emisor institucional válido.');

    const { data: creatorProfile, error: creatorError } = await admin
      .from('user_profiles')
      .select('auth_user_id,role,diocese_id,status,is_active')
      .eq('auth_user_id', creatorAuthId)
      .maybeSingle();

    if (creatorError) throw creatorError;
    if (!creatorProfile) throw new Error('No se encontró el perfil institucional que emitió el código.');

    const creatorRole = lower(creatorProfile.role);
    const creatorActive = creatorProfile.is_active !== false && upper(creatorProfile.status || 'ACTIVE') === 'ACTIVE';
    if (!creatorActive) throw new Error('El emisor del código ya no tiene una cuenta activa.');

    let role = '';
    let dioceseId: string | null = null;
    let parishId: string | null = null;
    let chanceryId: string | null = null;

    if (tokenType === 'DIOCESE') {
      if (creatorRole !== 'admin_general') {
        throw new Error('Sólo el Administrador General puede autorizar una Diócesis o Arquidiócesis.');
      }

      role = 'diocese';
      const entityName = text(data.name, 200);
      if (!entityName) throw new Error('El código no contiene el nombre de la jurisdicción.');

      const { data: entity, error } = await admin.from('dioceses').insert([{
        name: entityName,
        type: text(data.type, 40) || 'diocese',
        city: text(data.city, 160) || null,
        bishop: text(data.bishop, 200) || null,
        auxiliary_bishop: text(data.auxiliaryBishop, 200) || null,
        provincia_eclesiastica: text(data.provinciaEclesiastica, 200) || null,
        jurisdiccion_eclesiastica: text(data.jurisdiccionEclesiastica, 240) || null,
      }]).select('id').single();
      if (error) throw error;

      dioceseId = entity.id;
      createdEntity = { table: 'dioceses', id: entity.id };
    } else if (tokenType === 'PARISH') {
      if (creatorRole !== 'diocese') {
        throw new Error('Sólo una Diócesis/Arquidiócesis puede autorizar una Parroquia.');
      }

      role = 'parish';
      dioceseId = text(data.dioceseId, 80) || null;
      if (!dioceseId || dioceseId !== creatorProfile.diocese_id) {
        throw new Error('El código parroquial no pertenece a la jurisdicción que lo emitió.');
      }

      const entityName = text(data.name, 200);
      if (!entityName) throw new Error('El código no contiene el nombre de la parroquia.');

      let verifiedVicaryId: string | null = text(data.vicaryId, 80) || null;
      const requestedDeaneryId: string | null = text(data.decanateId, 80) || null;
      if (!verifiedVicaryId || !requestedDeaneryId) {
        throw new Error('Toda Parroquia debe quedar asignada a una Vicaría y a un Decanato.');
      }

      if (verifiedVicaryId) {
        const { data: vicary, error: vicaryError } = await admin
          .from('vicarias')
          .select('id,diocese_id')
          .eq('id', verifiedVicaryId)
          .maybeSingle();
        if (vicaryError) throw vicaryError;
        if (!vicary || vicary.diocese_id !== dioceseId) {
          throw new Error('La vicaría indicada no pertenece a la jurisdicción emisora.');
        }
      }

      if (requestedDeaneryId) {
        const { data: deanery, error: deaneryError } = await admin
          .from('decanatos')
          .select('id,diocese_id,vicaria_id')
          .eq('id', requestedDeaneryId)
          .maybeSingle();
        if (deaneryError) throw deaneryError;
        if (!deanery || deanery.diocese_id !== dioceseId) {
          throw new Error('El decanato indicado no pertenece a la jurisdicción emisora.');
        }
        if (verifiedVicaryId && deanery.vicaria_id !== verifiedVicaryId) {
          throw new Error('El decanato indicado no pertenece a la vicaría seleccionada.');
        }
        verifiedVicaryId = deanery.vicaria_id;
      }

      const { data: entity, error } = await admin.from('parishes').insert([{
        diocese_id: dioceseId,
        name: entityName,
        city: text(data.city, 160) || null,
        parroco: text(data.priest, 200) || null,
        vicary_id: verifiedVicaryId,
        decanate_id: requestedDeaneryId,
      }]).select('id').single();
      if (error) throw error;

      parishId = entity.id;
      createdEntity = { table: 'parishes', id: entity.id };
    } else if (tokenType === 'CHANCERY') {
      if (creatorRole !== 'diocese') {
        throw new Error('Sólo una Diócesis/Arquidiócesis puede autorizar su Cancillería.');
      }

      role = 'chancery';
      dioceseId = text(data.dioceseId, 80) || null;
      if (!dioceseId || dioceseId !== creatorProfile.diocese_id) {
        throw new Error('El código de Cancillería no pertenece a la jurisdicción que lo emitió.');
      }

      const { data: existingChancery, error: existingError } = await admin
        .from('chancelleries')
        .select('id')
        .eq('diocese_id', dioceseId)
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existingChancery) throw new Error('La jurisdicción ya tiene una Cancillería registrada.');

      const { data: entity, error } = await admin.from('chancelleries').insert([{
        diocese_id: dioceseId,
        name: text(data.name, 200) || 'Cancillería',
        city: text(data.city, 160) || null,
      }]).select('id').single();
      if (error) throw error;

      chanceryId = entity.id;
      createdEntity = { table: 'chancelleries', id: entity.id };
    } else {
      throw new Error('Tipo de activación no soportado.');
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        full_name: fullName || null,
        parish_id: parishId,
        diocese_id: dioceseId,
        chancery_id: chanceryId,
      },
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error('No se pudo crear la identidad de acceso.');
    createdAuthUserId = authData.user.id;

    const { error: profileError } = await admin.from('user_profiles').insert([{
      auth_user_id: createdAuthUserId,
      email,
      username: null,
      full_name: fullName || null,
      role,
      diocese_id: dioceseId,
      parish_id: parishId,
      chancery_id: chanceryId,
      status: 'ACTIVE',
      is_active: true,
    }]);
    if (profileError) throw profileError;

    claimedToken = null;
    return json(200, { success: true, role });
  } catch (error) {
    console.error('activate-environment failed', error);

    if (createdAuthUserId) {
      await admin.from('user_profiles').delete().eq('auth_user_id', createdAuthUserId);
      await admin.auth.admin.deleteUser(createdAuthUserId);
    }
    if (createdEntity) {
      await admin.from(createdEntity.table).delete().eq('id', createdEntity.id);
    }
    if (claimedToken) {
      await admin.from('pending_tokens').upsert(claimedToken, { onConflict: 'id' });
    }

    const message = error instanceof Error ? error.message : '';
    const domainMessage = message && !/duplicate key|violates|column|relation|syntax|postgres|pgrst/i.test(message)
      ? message
      : 'No fue posible completar la activación. Ningún acceso parcial debe utilizarse.';

    return json(400, { error: domainMessage });
  }
});
