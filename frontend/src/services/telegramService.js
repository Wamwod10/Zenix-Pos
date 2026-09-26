import { api } from "./apiClient";

export const createTelegramConnection=async({storeId}={})=>{
  const result=await api.post("/api/telegram/link",{storeId:storeId||null});
  return {connected:false,deepLink:result.deepLink,botUsername:result.botUsername,expiresInSeconds:result.expiresInSeconds};
};

export const listTelegramConnections=async()=>{
  const result=await api.get("/api/telegram/connections");
  return result.connections||[];
};

export const waitForTelegramConnection=async({storeId,timeoutMs=75_000,intervalMs=1500}={})=>{
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    const connections=await listTelegramConnections();
    const match=connections.find((item)=>item.enabled!==false&&(!storeId||String(item.store_id||item.storeId||"")===String(storeId)));
    if(match)return {connected:true,connectionId:match.id,chatId:String(match.chat_id||match.chatId||""),groupName:match.chat_title||match.groupName||"Telegram guruhi",connectedAt:match.linked_at||match.connectedAt||new Date().toISOString()};
    await new Promise((resolve)=>setTimeout(resolve,intervalMs));
  }
  return {connected:false,message:"Guruh hali ulanmagan. Telegram oynasida guruhni tanlab botni qo‘shing."};
};

export const disconnectTelegramGroup=async({connectionId}={})=>{
  if(!connectionId)throw new Error("Telegram ulanishi topilmadi");
  const result=await api.post(`/api/telegram/connections/${connectionId}/disconnect`,{});
  return {connected:false,connection:result.connection};
};

export const updateTelegramConnectionSettings=async({connectionId,settings}={})=>{
  if(!connectionId)throw new Error("Telegram ulanishi topilmadi");
  const result=await api.patch(`/api/telegram/connections/${connectionId}/settings`,{settings:settings||{}});
  return result.connection;
};

export const sendTelegramTestMessage=async({connectionId}={})=>{
  if(!connectionId)throw new Error("Telegram ulanishi topilmadi");
  await api.post(`/api/telegram/connections/${connectionId}/test`,{});
  return {success:true};
};

export const connectTelegramGroup=createTelegramConnection;
export default {createTelegramConnection,listTelegramConnections,waitForTelegramConnection,connectTelegramGroup,disconnectTelegramGroup,updateTelegramConnectionSettings,sendTelegramTestMessage};
