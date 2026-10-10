export const AUTH_SYNC_KEY='zenix:auth:revision:v1';
// Carries no identity or credentials; other tabs re-read their shared cookie.
export function notifyAuthChanged(){
  try{window.localStorage.setItem(AUTH_SYNC_KEY,`${Date.now()}:${Math.random()}`)}catch{}
}
