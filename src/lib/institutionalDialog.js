let subscriber = null;
const queue = [];

const publish = () => {
  if (subscriber) subscriber(queue[0] || null);
};

const requestDialog = (config) => new Promise((resolve) => {
  queue.push({ ...config, resolve });
  publish();
});

export const institutionalConfirm = ({
  title = 'Confirmar acción',
  message,
  confirmText = 'Sí, continuar',
  cancelText = 'Cancelar',
  tone = 'default'
} = {}) => requestDialog({
  kind: 'confirm', title, message, confirmText, cancelText, tone
});

export const institutionalPrompt = ({
  title = 'Información requerida',
  message,
  placeholder = '',
  confirmText = 'Continuar',
  cancelText = 'Cancelar',
  tone = 'default',
  required = false,
  minLength = 0,
  initialValue = ''
} = {}) => requestDialog({
  kind: 'prompt', title, message, placeholder, confirmText, cancelText,
  tone, required, minLength, initialValue
});

export const institutionalAlert = ({
  title = 'Aviso',
  message,
  confirmText = 'Entendido',
  tone = 'default'
} = {}) => requestDialog({ kind: 'alert', title, message, confirmText, tone });

export const subscribeInstitutionalDialogs = (nextSubscriber) => {
  subscriber = nextSubscriber;
  publish();
  return () => {
    if (subscriber === nextSubscriber) subscriber = null;
  };
};

export const settleInstitutionalDialog = (value) => {
  const current = queue.shift();
  if (current?.resolve) current.resolve(value);
  publish();
};
