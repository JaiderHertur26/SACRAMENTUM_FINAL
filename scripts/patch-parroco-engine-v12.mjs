import fs from 'node:fs';
const file='C:/SACRAMENTUM/SACRAMENTUM_FINAL/src/services/catalogsService.js';
let s=fs.readFileSync(file,'utf8');
const start=s.indexOf('// 🚀 MOTOR DE AUTO-CÁLCULO DEL PÁRROCO ACTUAL');
const end=s.indexOf('export const addParroco = async',start);
if(start<0||end<0) throw new Error('markers not found');
const block=`// MOTOR CANÓNICO DEL PÁRROCO ACTUAL · no fabrica fechas históricas
export const actualizarParrocoActual = async (parishId) => {
    if (!parishId) return;
    try {
        const { error: rpcError } = await supabase.rpc('sacramentum_recalculate_current_priest', {
            p_parish_id: parishId
        });
        if (rpcError) throw rpcError;

        const { data, error } = await supabase
            .from('parrocos')
            .select('*')
            .eq('parish_id', parishId)
            .order('fecha_ingreso', { ascending: false, nullsFirst: false });
        if (error) throw error;

        const normalized=(data || []).map(row => ({
            ...(row.payload || {}),
            id: row.id,
            nombre: row.nombre || row.payload?.nombre || '',
            apellido: row.apellido || row.payload?.apellido || '',
            email: row.email || row.payload?.email || '',
            telefono: row.telefono || row.payload?.telefono || '',
            fechaIngreso: row.fecha_ingreso || row.payload?.fechaIngreso || '',
            fechaSalida: row.fecha_salida || row.payload?.fechaSalida || '',
            estado: row.estado || ''
        }));
        localStorage.setItem(\`parrocos_\${parishId}\`,JSON.stringify(normalized));
        return normalized;
    } catch (e) {
        console.error('Error recalculando Párroco actual:',e);
        return [];
    }
};

`;
s=s.slice(0,start)+block+s.slice(end);
fs.writeFileSync(file,s);
console.log('patched');
