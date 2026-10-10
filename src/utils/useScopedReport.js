import {useEffect,useState,useCallback} from 'react';
import {apiRequest} from '../services/apiClient';
import {loadScopedReport} from './scopedReport';
import {useAuth} from '../context/AuthContext';

const empty={sales:[],returns:[],expenses:[],aggregate:null,pagination:{total:0,returnTotal:0,hasMore:false}};
export default function useScopedReport(options,{allPages=false,revision=''}={}){
  const {currentUser}=useAuth();
  const key=JSON.stringify(options),scopeKey=`${currentUser?.organizationId||''}:${currentUser?.id||''}:${key}`;
  const [generation,setGeneration]=useState(0);
  const [state,setState]=useState({...empty,loading:true,error:''});
  const reload=useCallback(()=>setGeneration(value=>value+1),[]);
  useEffect(()=>{
    const controller=new AbortController();
    setState({...empty,scopeKey,loading:true,error:''});
    loadScopedReport(apiRequest,JSON.parse(key),{signal:controller.signal,allPages})
      .then(result=>{if(!controller.signal.aborted)setState({...result,scopeKey,loading:false,error:''});})
      .catch(error=>{if(!controller.signal.aborted)setState({...empty,scopeKey,loading:false,error:error.message});});
    return()=>controller.abort();
  },[key,scopeKey,allPages,revision,generation]);
  return {...(state.scopeKey===scopeKey?state:{...empty,loading:true,error:''}),reload};
}

export function reportSales(report){
  const map=new Map(report.sales.map(sale=>[sale.id,sale]));
  for(const ret of report.returns)if(ret.sourceSale&&!map.has(ret.saleId))map.set(ret.saleId,ret.sourceSale);
  return [...map.values()];
}
