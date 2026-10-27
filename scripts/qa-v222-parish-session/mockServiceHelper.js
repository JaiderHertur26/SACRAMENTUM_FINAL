export const deferred=(kind,scopeId)=>new Promise(resolve=>{
 const qa=window.__qa222;
 qa.pending.push({kind,scopeId,resolve});
});
export const record=(type,payload)=>window.__qa222.calls.push({type,payload});