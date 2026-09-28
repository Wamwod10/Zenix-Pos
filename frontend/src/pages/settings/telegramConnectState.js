export function telegramConnectActionState({canWrite,busy,connecting}){
  return {
    disabled:!canWrite||busy,
    label:busy?"Havola yaratilmoqda...":connecting?"Ulash havolasini qayta ochish":"Telegram guruhini ulash",
  };
}

export const isCurrentTelegramConnectAttempt=({signal,attempt,currentAttempt})=>!signal?.aborted&&attempt===currentAttempt;

export const openTelegramHandoff=(openWindow)=>{
  const target=openWindow?.("about:blank","_blank")||null;
  if(target)target.opener=null;
  return target;
};

export const sendTelegramHandoff=(target,deepLink)=>{
  if(!target||target.closed)return false;
  target.location.replace(deepLink);
  return true;
};

export function telegramReturnUrl(href){
  const url=new URL(href);
  url.searchParams.set("tab","Telegram");
  return url.toString();
}

