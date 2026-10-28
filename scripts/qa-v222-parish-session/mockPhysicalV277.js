// V222 isolates the old inbox session test from V277 RPCs. No network or DB calls.
export async function updatePhysicalLocatorV277(){ throw new Error('V222 mock: physical locator not part of legacy session test'); }
