// Reads public bootstrap status without changing authorization semantics.
// Old backend deployments may not support /session; fall back to protected /me.
export async function fetchSessionBootstrap(get,options){
  if(typeof get!=='function')throw new TypeError('HTTP GET implementation required');
  try{return await get('/api/auth/session',options)}
  catch(error){
    if(error?.status===404)return get('/api/auth/me',options);
    throw error;
  }
}
