import {useCallback,useEffect,useRef,useState} from "react";
import {api} from "../services/apiClient";

export default function useWarehouses({organizationId,storeId,revision}){
  const scope=JSON.stringify([organizationId,storeId]);
  const currentScope=useRef(scope);currentScope.current=scope;
  const request=useRef(null);
  const [data,setData]=useState({scope:null,warehouses:[],balances:[],selectedId:"",loading:false,error:""});
  const selectionKey=`zenix_warehouse:${scope}`;
  const reload=useCallback(async()=>{
    request.current?.abort();
    const controller=new AbortController();request.current=controller;
    if(!organizationId||!storeId){setData({scope,warehouses:[],balances:[],selectedId:"",loading:false,error:""});return}
    setData(previous=>previous.scope===scope?{...previous,loading:true,error:""}:{scope,warehouses:[],balances:[],selectedId:"",loading:true,error:""});
    try{
      const response=await api.get(`/api/warehouses?storeId=${encodeURIComponent(storeId)}`,{signal:controller.signal});
      if(controller.signal.aborted||currentScope.current!==scope)return;
      const warehouses=(response.warehouses||[]).filter(row=>String(row.store_id||row.storeId)===String(storeId)&&row.active!==false);
      const ids=new Set(warehouses.map(row=>String(row.id)));
      const balances=(response.balances||[]).filter(row=>ids.has(String(row.warehouse_id||row.warehouseId)));
      let saved="";try{saved=window.localStorage.getItem(selectionKey)||""}catch{}
      setData(previous=>({scope,warehouses,balances,loading:false,error:"",selectedId:[previous.scope===scope?previous.selectedId:"",saved].find(id=>ids.has(String(id)))||warehouses.find(row=>row.is_default)?.id||warehouses[0]?.id||""}));
    }catch(error){
      if(controller.signal.aborted||currentScope.current!==scope)return;
      setData(previous=>({...previous,scope,loading:false,error:error.message||"Omborlar yuklanmadi"}));
    }
  },[organizationId,storeId,scope,selectionKey]);
  useEffect(()=>{reload();return()=>request.current?.abort()},[reload,revision]);
  const setSelectedId=useCallback(id=>{
    if(currentScope.current!==scope)return;
    setData(previous=>{
      if(previous.scope!==scope||!previous.warehouses.some(row=>String(row.id)===String(id)))return previous;
      try{window.localStorage.setItem(selectionKey,String(id))}catch{}
      return {...previous,selectedId:id};
    });
  },[scope,selectionKey]);
  const visible=data.scope===scope?data:{warehouses:[],balances:[],selectedId:"",loading:Boolean(storeId),error:""};
  return {...visible,organizationId,storeId,scope,setSelectedId,reload};
}
