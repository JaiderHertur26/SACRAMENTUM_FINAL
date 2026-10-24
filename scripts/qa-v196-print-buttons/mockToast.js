export const toast=message=>window.__qa196?.toasts.push({title:message.title||'',description:message.description||''});
const handleToast=toast;
const stable={toast:handleToast};
export const useToast=()=>stable;
