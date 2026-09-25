export const generateBackup = (data, user) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let backupData = {};
  let filename = `respaldo-${user.role}-${timestamp}.json`;

  if (user.role === 'admin_general') {
    backupData = { ...data };
    filename = `respaldo-global-${timestamp}.json`;
  } else if (['diocese', 'archdiocese'].includes(user.role)) {
    backupData = {
      ...data,
      users: data.users.filter(u => u.dioceseId === user.dioceseId),
      parishes: data.parishes.filter(p => p.dioceseId === user.dioceseId),
      vicariates: data.vicariates.filter(v => v.dioceseId === user.dioceseId),
      deaneries: data.deaneries.filter(d => data.vicariates.find(v => v.id === d.vicariateId)?.dioceseId === user.dioceseId),
      sacraments: data.sacraments.filter(s => s.dioceseId === user.dioceseId)
    };
    filename = `respaldo-diocesis-${user.dioceseName?.replace(/\s+/g, '_') || 'diocesis'}-${timestamp}.json`;
  } else if (user.role === 'parish') {
    backupData = {
      ...data,
      users: data.users.filter(u => u.parishId === user.parishId),
      parishes: data.parishes.filter(p => p.id === user.parishId),
      sacraments: data.sacraments.filter(s => s.parishId === user.parishId)
    };
    filename = `respaldo-parroquia-${user.parishName?.replace(/\s+/g, '_') || 'parroquia'}-${timestamp}.json`;
  }

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const validateBackup = (jsonData) => {
  const requiredKeys = ['users', 'sacraments', 'parishes'];
  const keys = Object.keys(jsonData);
  if (!requiredKeys.some(key => keys.includes(key))) {
    throw new Error('Formato de respaldo inválido: faltan entidades principales.');
  }
  return true;
};