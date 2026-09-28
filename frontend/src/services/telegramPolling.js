const abortedResult={connected:false,aborted:true};

const delay=(milliseconds,signal)=>new Promise((resolve)=>{
  if(signal?.aborted)return resolve(false);
  const onAbort=()=>{clearTimeout(timer);resolve(false)};
  const timer=setTimeout(()=>{signal?.removeEventListener("abort",onAbort);resolve(true)},milliseconds);
  signal?.addEventListener("abort",onAbort,{once:true});
});

export const telegramConnectionForStore=(connections=[],storeId)=>{
  const match=connections.find((item)=>item.enabled!==false&&(!storeId||String(item.store_id||item.storeId||"")===String(storeId)));
  if(!match)return {connected:false};
  return {connected:true,connectionId:match.id,chatId:String(match.chat_id||match.chatId||""),groupName:match.chat_title||match.groupName||"Telegram guruhi",connectedAt:match.linked_at||match.connectedAt||null};
};

export const waitForTelegramConnection=async({storeId,timeoutMs=75_000,intervalMs=1500,signal,loadConnections}={})=>{
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    if(signal?.aborted)return abortedResult;
    const connections=await loadConnections();
    if(signal?.aborted)return abortedResult;
    const connection=telegramConnectionForStore(connections,storeId);
    if(connection.connected)return {...connection,connectedAt:connection.connectedAt||new Date().toISOString()};
    if(!await delay(intervalMs,signal))return abortedResult;
  }
  return {connected:false,message:"Guruh hali ulanmagan. Telegram oynasida guruhni tanlab botni qoвЂshing."};
};
