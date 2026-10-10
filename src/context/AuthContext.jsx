import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { normalizeSessionUser, legacyRoleForAppRole, runForOrganizationUser, ROLES } from "../config/roles";
import { api, ApiError } from "../services/apiClient";
import { formatUzPhone, isValidUzPhone } from "../utils/phone";
import {DEFAULT_ROLE_PERMISSIONS} from '../config/uiDefaults';

const AuthContext=createContext(null);

const cleanUser=(user)=>{
  const normalized=normalizeSessionUser(user);
  if(!normalized)return null;
  return {
    ...normalized,
    forcePasswordChange:Boolean(user.forcePasswordChange??user.mustChangePassword),
  };
};
const apiMessage=(error,fallback)=>error instanceof ApiError&&error.message?error.message:fallback;

export const AuthProvider=({children})=>{
  const [currentUser,setCurrentUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [workspaceAccounts,setWorkspaceAccounts]=useState([]);
  const [sessions,setSessions]=useState([]);

  const refreshSessions=useCallback(async()=>{
    try{
      const data=await api.get("/api/users/me/sessions");
      setSessions((data.sessions||[]).map((item)=>({...item,device:item.device||"Brauzer"})));
      return data.sessions||[];
    }catch{
      setSessions([]);
      return [];
    }
  },[]);

  const refreshWorkspaceAccounts=useCallback(async()=>{
    const allowed=currentUser?.appRole===ROLES.OWNER||Boolean(currentUser?.permissionOverrides?.settingsWrite??currentUser?.rolePermissions?.[currentUser?.appRole]?.settingsWrite??DEFAULT_ROLE_PERMISSIONS[currentUser?.appRole]?.settingsWrite);
    if(!currentUser?.organizationId||!allowed){setWorkspaceAccounts([]);return []}
    try{
      const data=await api.get("/api/users");
      const users=(data.users||[]).map(cleanUser).filter(Boolean);
      setWorkspaceAccounts(users);
      return users;
    }catch(error){
      // Roles without settings access are intentionally unable to enumerate staff.
      if(error?.status!==403)setWorkspaceAccounts([]);
      return [];
    }
  },[currentUser]);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const data=await api.get("/api/auth/me");
        if(cancelled)return;
        setCurrentUser(cleanUser(data.user));
      }catch(error){
        if(cancelled)return;
        if(error?.status!==401&&error?.code!=="API_NOT_CONFIGURED")console.error("[auth] session restore failed",error);
        setCurrentUser(null);
      }finally{
        if(!cancelled)setAuthLoading(false);
      }
    })();
    return()=>{cancelled=true};
  },[]);

  useEffect(()=>{
    if(!currentUser){setWorkspaceAccounts([]);setSessions([]);return}
    const started=runForOrganizationUser(currentUser,()=>{
      void refreshSessions();
      void refreshWorkspaceAccounts();
    });
    if(!started){setWorkspaceAccounts([]);setSessions([])}
  },[currentUser?.id,currentUser?.organizationId,currentUser?.appRole,refreshSessions,refreshWorkspaceAccounts]);

  const login=async(username,password)=>{
    try{
      const data=await api.post("/api/auth/login",{username:String(username||"").trim(),password});
      const user=cleanUser(data.user);
      setCurrentUser(user);
      return {success:true,user};
    }catch(error){return {success:false,message:apiMessage(error,"Tizimga kirib bo‘lmadi")}}
  };

  const register=async(form)=>{
    try{
      const data=await api.post("/api/auth/register",{
        businessName:String(form?.businessName||"").trim(),
        ownerName:String(form?.ownerName||"").trim(),
        phone:formatUzPhone(form?.phone||""),
        username:String(form?.login||form?.username||"").trim(),
        password:String(form?.password||""),startOption:form?.startOption||"TRIAL",
      });
      const user=cleanUser(data.user);
      setCurrentUser(user);
      return {success:true,user};
    }catch(error){return {success:false,message:apiMessage(error,"Ro‘yxatdan o‘tib bo‘lmadi")}}
  };

  // Availability is always enforced by PostgreSQL. This synchronous helper only
  // provides instant feedback for already-loaded staff accounts.
  const isLoginTaken=(login)=>{
    const normalized=String(login||"").trim().toLowerCase();
    if(!normalized)return false;
    return workspaceAccounts.some((item)=>String(item.username||"").toLowerCase()===normalized);
  };

  const createWorkspaceUser=async(payload)=>{
    try{
      const data=await api.post("/api/users",{
        name:String(payload?.name||"").trim(),
        username:String(payload?.username||"").trim(),
        phone:formatUzPhone(payload?.phone||""),
        password:String(payload?.password||""),
        appRole:payload?.appRole,
        storeId:payload?.storeId||null,
        permissionOverrides:payload?.permissionOverrides||{},
      });
      const user=cleanUser(data.user);
      setWorkspaceAccounts((items)=>[...items.filter((item)=>item.id!==user.id),user]);
      return {success:true,user};
    }catch(error){return {success:false,message:apiMessage(error,"Xodim hisobini yaratib bo‘lmadi")}}
  };

  const resolveAccountId=(employeeId)=>workspaceAccounts.find((item)=>item.id===employeeId||item.accountId===employeeId)?.id||employeeId;

  const updateWorkspaceUser=async(employeeId,patch)=>{
    const id=resolveAccountId(employeeId);
    const body={};
    if(Object.prototype.hasOwnProperty.call(patch,"name"))body.name=patch.name;
    if(Object.prototype.hasOwnProperty.call(patch,"username"))body.username=patch.username;
    if(Object.prototype.hasOwnProperty.call(patch,"phone"))body.phone=formatUzPhone(patch.phone||"");
    if(Object.prototype.hasOwnProperty.call(patch,"appRole"))body.appRole=patch.appRole;
    if(Object.prototype.hasOwnProperty.call(patch,"storeId"))body.storeId=patch.storeId||null;
    if(Object.prototype.hasOwnProperty.call(patch,"active"))body.active=Boolean(patch.active);
    if(Object.prototype.hasOwnProperty.call(patch,"permissionOverrides"))body.permissionOverrides=patch.permissionOverrides||{};
    try{
      const data=await api.patch(`/api/users/${encodeURIComponent(id)}`,body);
      const user=cleanUser(data.user);
      setWorkspaceAccounts((items)=>items.map((item)=>item.id===user.id?user:item));
      if(user.id===currentUser?.id)setCurrentUser((previous)=>cleanUser({...previous,...user}));
      return {success:true,user};
    }catch(error){return {success:false,message:apiMessage(error,"Xodim hisobini yangilab bo‘lmadi")}}
  };

  const resetWorkspaceUserPassword=async(employeeId,password)=>{
    const id=resolveAccountId(employeeId);
    try{
      await api.post(`/api/users/${encodeURIComponent(id)}/reset-password`,{password});
      return {success:true};
    }catch(error){return {success:false,message:apiMessage(error,"Parolni yangilab bo‘lmadi")}}
  };

  const changeCurrentPassword=async({currentPassword,newPassword})=>{
    if(String(newPassword||"").length<8)return {success:false,message:"Yangi parol kamida 8 ta belgidan iborat bo‘lsin"};
    try{
      await api.post("/api/users/me/password",{currentPassword,newPassword});
      setCurrentUser((previous)=>previous?{...previous,forcePasswordChange:false}:previous);
      await refreshSessions();
      return {success:true};
    }catch(error){return {success:false,message:apiMessage(error,"Parolni yangilab bo‘lmadi")}}
  };

  const getWorkspaceAccounts=(organizationId)=>workspaceAccounts.filter((item)=>!organizationId||item.organizationId===organizationId);
  const getEmployeeAccount=(employeeId,employee=null)=>workspaceAccounts.find((item)=>item.id===employeeId||item.accountId===employeeId||(employee?.login&&item.username===employee.login))||null;

  const upsertEmployeeAccount=async({employee,username,password})=>{
    if(!employee?.id||!currentUser?.organizationId)return {success:false,message:"Xodim yoki tashkilot topilmadi"};
    const existing=getEmployeeAccount(employee.id,employee);
    if(existing){
      const result=await updateWorkspaceUser(existing.id,{name:employee.name,username,appRole:employee.role,storeId:employee.storeId||null,active:employee.active!==false,...(isValidUzPhone(employee.phone)?{phone:employee.phone}:{})});
      if(result.success&&password)return resetWorkspaceUserPassword(existing.id,password);
      return result;
    }
    return createWorkspaceUser({name:employee.name,phone:employee.phone||"",username,password,appRole:employee.role,storeId:employee.storeId||null});
  };

  const syncEmployeeAccount=(employee)=>{
    const existing=getEmployeeAccount(employee?.id,employee);
    if(!existing)return;
    void updateWorkspaceUser(existing.id,{name:employee.name,appRole:employee.role,storeId:employee.storeId||null,active:employee.active!==false,...(isValidUzPhone(employee.phone)?{phone:employee.phone}:{})});
  };

  const updateCurrentProfile=async({name,phone})=>{
    const normalizedName=String(name||"").trim();
    const normalizedPhone=formatUzPhone(phone||"");
    if(!normalizedName)return {success:false,message:"Ism va familiyani kiriting"};
    if(!isValidUzPhone(normalizedPhone))return {success:false,message:"Telefon raqamini +998 XX XXX XX XX formatida to‘liq kiriting"};
    try{
      const data=await api.patch("/api/users/me/profile",{name:normalizedName,phone:normalizedPhone});
      const user=cleanUser({...currentUser,...data.user});
      setCurrentUser(user);
      setWorkspaceAccounts((items)=>items.map((item)=>item.id===user.id?user:item));
      return {success:true,user};
    }catch(error){return {success:false,message:apiMessage(error,"Profilni saqlab bo‘lmadi")}}
  };

  const getActiveSessions=()=>sessions;
  const revokeSession=async(sessionId)=>{
    try{
      const data=await api.delete(`/api/users/me/sessions/${encodeURIComponent(sessionId)}`);
      if(data.current){setCurrentUser(null);setSessions([])}else setSessions((items)=>items.filter((item)=>item.id!==sessionId));
      return {success:true};
    }catch(error){return {success:false,message:apiMessage(error,"Sessiyani yopib bo‘lmadi")}}
  };
  const revokeOtherSessions=async()=>{
    try{
      await api.delete("/api/users/me/sessions/others");
      setSessions((items)=>items.filter((item)=>item.current));
      return {success:true};
    }catch(error){return {success:false,message:apiMessage(error,"Boshqa sessiyalarni yopib bo‘lmadi")}}
  };

  const logout=async()=>{
    try{
      await api.post("/api/auth/logout",{});
      setCurrentUser(null);setWorkspaceAccounts([]);setSessions([]);
      return {success:true};
    }catch(error){
      return {success:false,message:apiMessage(error,"Tizimdan chiqib bo‘lmadi")};
    }
  };

  const value=useMemo(()=>({
    currentUser,authLoading,login,register,isLoginTaken,createWorkspaceUser,updateWorkspaceUser,resetWorkspaceUserPassword,changeCurrentPassword,
    getWorkspaceAccounts,getEmployeeAccount,upsertEmployeeAccount,syncEmployeeAccount,updateCurrentProfile,getActiveSessions,revokeSession,revokeOtherSessions,
    refreshWorkspaceAccounts,refreshSessions,logout,
  }),[currentUser,authLoading,workspaceAccounts,sessions,refreshWorkspaceAccounts,refreshSessions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth=()=>{
  const value=useContext(AuthContext);
  if(!value)throw new Error("useAuth must be used inside AuthProvider");
  return value;
};
