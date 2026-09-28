import { api } from "./apiClient";
import { waitForTelegramConnection as pollForTelegramConnection } from "./telegramPolling";

export const createTelegramConnection=async({storeId}={})=>{
  const result=await api.post("/api/telegram/link",{storeId:storeId||null});
  return {connected:false,deepLink:result.deepLink,fallbackCommand:result.fallbackCommand,botUsername:result.botUsername,expiresInSeconds:result.expiresInSeconds};
};

export const listTelegramConnections=async()=>{
  const result=await api.get("/api/telegram/connections");
  return result.connections||[];
};

export const waitForTelegramConnection=(options={})=>pollForTelegramConnection({...options,loadConnections:listTelegramConnections});

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
