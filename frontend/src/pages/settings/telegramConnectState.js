export function telegramConnectActionState({canWrite,busy,connecting}){
  return {
    disabled:!canWrite||busy,
    label:busy?"Havola yaratilmoqda...":connecting?"Ulash havolasini qayta ochish":"Telegram guruhini ulash",
  };
}

export const isCurrentTelegramConnectAttempt=({signal,attempt,currentAttempt})=>!signal?.aborted&&attempt===currentAttempt;

export const telegramFallbackState=({connected,fallbackCommand,fallbackExpiresAt,now=Date.now()})=>{
  const command=String(fallbackCommand||"").trim();
  const validUntil=Number(fallbackExpiresAt||0);
  const visible=!connected&&Boolean(command)&&Number.isFinite(validUntil)&&validUntil>now;
  return {visible,command:visible?command:""};
};

export const telegramFallbackPollWindow=({fallbackExpiresAt,now=Date.now(),maxMs=75_000})=>Math.max(0,Math.min(maxMs,Number(fallbackExpiresAt||0)-now));

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

