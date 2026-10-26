export const validateNewPassword = (password, confirmation) => {
  if (typeof password !== 'string' || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (password.length > 256) return 'La contraseña no puede superar 256 caracteres.';
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return null;
};

export async function completePasswordResetWithClient(client, password, confirmation) {
  const validation = validateNewPassword(password, confirmation);
  if (validation) throw new Error(validation);
  // A stored browser projection or a URL flag never authorizes a password change.
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError || !identity?.user?.id) throw new Error('El enlace no es válido o ha caducado. Solicita uno nuevo.');
  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw error;
  if (data?.user?.id !== identity.user.id) throw new Error('No fue posible confirmar el cambio de contraseña.');
  return { success: true };
}
