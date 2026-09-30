import { createRequestCoordinator } from "./requestCoordinator";

const RAW_API_URL=String(import.meta.env.VITE_API_URL||"").trim().replace(/\/$/,"");
export const API_URL=RAW_API_URL;

export class ApiError extends Error{
  constructor(message,{status=0,code="API_ERROR",details}={}){super(message);this.name="ApiError";this.status=status;this.code=code;this.details=details}
}

const ensureApi=()=>true;
const requestCoordinator=createRequestCoordinator();
const getKey=(path,headers={})=>`${path}::${JSON.stringify(headers||{})}`;
const parseError=async(response)=>{
  const payload=await response.clone().json().catch(()=>null);
  const error=payload?.error||{};
  return new ApiError(error.message||`Server xatosi (${response.status})`,{status:response.status,code:error.code||"API_ERROR",details:error.details});
};

export async function apiRequest(path,{method="GET",body,headers={},signal}={}){
  ensureApi();
  const response=await fetch(`${API_URL}${path}`,{
    method,credentials:"include",signal,
    headers:{"X-Zenix-Client":"web",...(body===undefined?{}:{"Content-Type":"application/json"}),...headers},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.ok===false){const error=payload?.error||{};throw new ApiError(error.message||`Server xatosi (${response.status})`,{status:response.status,code:error.code||"API_ERROR",details:error.details})}
  return payload?.data??payload;
}

export async function apiUpload(path,file,{signal,headers={}}={}){
  ensureApi();
  if(!file)throw new ApiError("Fayl tanlanmagan",{code:"FILE_REQUIRED"});
  const response=await fetch(`${API_URL}${path}`,{
    method:"POST",credentials:"include",signal,
    headers:{"X-Zenix-Client":"web","Content-Type":file.type||"application/octet-stream","X-File-Name":encodeURIComponent(file.name||"file"),...headers},
    body:file,
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||payload?.ok===false){const error=payload?.error||{};throw new ApiError(error.message||`Server xatosi (${response.status})`,{status:response.status,code:error.code||"API_ERROR",details:error.details})}
  return payload?.data??payload;
}

export async function apiBlob(path,{signal}={}){
  ensureApi();
  const response=await fetch(`${API_URL}${path}`,{method:"GET",credentials:"include",signal});
  if(!response.ok)throw await parseError(response);
  return response.blob();
}

export const api={
  get:(path,options={})=>{
    if(options?.signal)return apiRequest(path,{...options,method:"GET"});
    const key=getKey(path,options?.headers);
    return requestCoordinator.get(key,()=>apiRequest(path,{...options,method:"GET"}));
  },
  post:(path,body,options={})=>requestCoordinator.mutate(()=>apiRequest(path,{...options,method:"POST",body})),
  patch:(path,body,options={})=>requestCoordinator.mutate(()=>apiRequest(path,{...options,method:"PATCH",body})),
  delete:(path,options={})=>requestCoordinator.mutate(()=>apiRequest(path,{...options,method:"DELETE"})),
  upload:apiUpload,
  blob:apiBlob,
};
