export const toast=(x)=>window.__qa222.toasts.push({title:x.title||'',description:x.description||''});
export const useToast=()=>({toast});