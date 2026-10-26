import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '../../services/apiClient';
import {productFromApi} from '../../context/StoreContext';
import {createPosCatalog} from '../../utils/posCatalog';

export default function useProCatalog(storeId){
 const [view,setView]=useState({products:[],results:[],categories:[],hasMore:false}),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const [appliedQuery,setAppliedQuery]=useState(null);
 const controller=useRef(null),active=useRef(true),searchVersion=useRef(0);
 useEffect(()=>{
  active.current=true;
  controller.current=createPosCatalog({request:query=>api.get(`/api/bootstrap/catalog?${new URLSearchParams({storeId,...query})}`,{signal:AbortSignal.timeout(15000)}),normalize:row=>{
   const stock=row.stockByStore||row.stock_by_store;
   if(!stock||!Object.hasOwn(stock,storeId)||!Number.isFinite(Number(stock[storeId])))throw Error('Filial qoldig‘i tekshirilmagan');
   const p=productFromApi(row,[storeId]);return {...p,referenceCostPrice:p.referenceCostPrice??p.costPrice,costPrice:Number(p.costByStore?.[storeId]??p.costPrice??0),quantity:Number(stock[storeId]),stock:Number(stock[storeId])};
  },onChange:setView});
  return()=>{active.current=false;controller.current?.dispose()};
 },[storeId]);
 const search=useCallback(async(query={},append=false)=>{
  const version=++searchVersion.current;setPending(true);setError('');
  try{const result=await controller.current.search(query,append);if(result&&active.current&&version===searchVersion.current&&!append)setAppliedQuery({search:query.search||'',category:query.category||''});return result}catch(e){if(active.current&&version===searchVersion.current)setError(e.message);return null}
  finally{if(active.current&&version===searchVersion.current)setPending(false)}
 },[]);
 const resolve=useCallback(ids=>controller.current.resolve(ids),[]);
 const barcode=useCallback(code=>controller.current.barcode(code),[]);
 const pin=useCallback(ids=>controller.current.pin(ids),[]);
 return {view,error,pending,appliedQuery,search,resolve,barcode,pin};
}
