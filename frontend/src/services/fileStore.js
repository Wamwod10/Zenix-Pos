import { api } from "./apiClient";

// Backward-compatible service names. Files are stored by the Zenix POS backend.
export const saveLocalFile=async(file)=>{
  const result=await api.upload("/api/files",file);
  return result?.file?.id||"";
};

export const readLocalFile=async(key)=>{
  if(!key)return null;
  return api.blob(`/api/files/${encodeURIComponent(key)}`);
};

export const deleteLocalFile=async(key)=>{
  if(!key)return;
  await api.delete(`/api/files/${encodeURIComponent(key)}`);
};
