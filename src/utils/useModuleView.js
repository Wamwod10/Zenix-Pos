import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { moduleViewKey, readModuleView } from "./moduleViewPreference";
export default function useModuleView(module){
 const {currentUser}=useAuth();const key=moduleViewKey(module,currentUser?.organizationId,currentUser?.id);
 const [choice,setChoice]=useState(null);let storage;try{storage=window.localStorage}catch{}
 const view=choice?.key===key?choice.view:readModuleView(storage,key);
 const setView=next=>{if(!["grid","list"].includes(next))return;setChoice({key,view:next});try{storage.setItem(key,next)}catch{}};
 return [view,setView];
}
