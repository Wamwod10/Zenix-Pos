// Reads public bootstrap status without changing authorization semantics.
// Older backends and legacy adapters may not support the optional response.
// A malformed success falls back to the protected identity endpoint; auth
// failures (401/403/5xx) still propagate without retry.
export async function fetchSessionBootstrap(get,options){
  if(typeof get!=='function')throw new TypeError('HTTP GET implementation required');
  try{
    const data=await get('/api/auth/session',options);
    if(data&&typeof data==='object'&&!Array.isArray(data)&&Object.hasOwn(data,'user'))return data;
  }catch(error){
    if(error?.status!==404)throw error;
  }
  return get('/api/auth/me',options);
}
