// Called synchronously from a user gesture; browsers decide window/tab placement.
export function launchPosPro(navigate,host=window){
 try{
  const width=Math.min(1920,Math.max(1024,host.screen?.availWidth||1366));
  const height=Math.min(1200,Math.max(768,host.screen?.availHeight||900));
  const popup=host.open('','zenix-pos-pro',`popup=yes,width=${width},height=${height},resizable=yes,scrollbars=yes`);
  if(popup){
   // Reusing the menu must focus an existing cashier, not reload its pending work.
   if(popup.location.pathname!=='/pos-pro')popup.location.replace('/pos-pro');
   popup.opener=null;popup.focus?.();return 'window';
  }
 }catch{/* Popup denied or unavailable. The same protected route is the fallback. */}
 navigate('/pos-pro');return 'same-tab';
}
